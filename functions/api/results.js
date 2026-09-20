// Cloudflare Pages Function
// Handles GET /api/results?key=YOUR_ADMIN_KEY — returns a tally of all poll responses.
//
// Setup required in Cloudflare dashboard (Pages project > Settings > Environment variables):
//   Add a variable named ADMIN_KEY with a password you choose (keep it private).
//
// To view results once deployed, visit:
//   https://YOUR-SUBDOMAIN/api/results?key=YOUR_ADMIN_KEY
//
// This extends the senior-ai-poll project's results.js to also tally:
//   - multi-select ("choose up to N") array fields
//   - more than one open-text field
//   - a simple boolean opt-in checkbox (marketingOptIn)

const SINGLE_CHOICE_FIELDS = [
  "ageBand",
  "relationship",
  "aiFrequency",
  "familiarity",
  "spendHistory",
  "positioning",
  "workshopLikelihood",
  "decisionMaker",
  "format",
  "sponsorTolerance",
  "pilotInterest"
];

const MULTI_SELECT_FIELDS = [
  "situation",
  "payOutcomes",
  "payRequirements",
  "obstacles"
];

const OPEN_TEXT_FIELDS = ["helpWish", "workshopReason", "openText"];

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const list = await env.POLL_RESPONSES.list({ prefix: "submission:" });
  const submissions = [];

  for (const item of list.keys) {
    const raw = await env.POLL_RESPONSES.get(item.name);
    if (raw) {
      try {
        submissions.push(JSON.parse(raw));
      } catch (e) {
        // skip malformed entry
      }
    }
  }

  const tally = {
    totalResponses: submissions.length,
    interestAverages: {},
    openTextResponses: {},
    emails: [],
    marketingOptIns: 0
  };

  SINGLE_CHOICE_FIELDS.forEach(field => (tally[field] = {}));
  MULTI_SELECT_FIELDS.forEach(field => (tally[field] = {}));
  OPEN_TEXT_FIELDS.forEach(field => (tally.openTextResponses[field] = []));

  const interestSums = {};
  const interestCounts = {};

  submissions.forEach(sub => {
    SINGLE_CHOICE_FIELDS.forEach(field => {
      const val = sub[field];
      if (val) {
        tally[field][val] = (tally[field][val] || 0) + 1;
      }
    });

    MULTI_SELECT_FIELDS.forEach(field => {
      const vals = sub[field];
      if (Array.isArray(vals)) {
        vals.forEach(v => {
          if (v) tally[field][v] = (tally[field][v] || 0) + 1;
        });
      }
    });

    if (sub.interests && typeof sub.interests === "object") {
      Object.entries(sub.interests).forEach(([topic, rating]) => {
        interestSums[topic] = (interestSums[topic] || 0) + Number(rating);
        interestCounts[topic] = (interestCounts[topic] || 0) + 1;
      });
    }

    OPEN_TEXT_FIELDS.forEach(field => {
      const val = sub[field];
      if (val && String(val).trim()) {
        tally.openTextResponses[field].push(String(val).trim());
      }
    });

    if (sub.email && sub.email.trim()) {
      tally.emails.push(sub.email.trim());
    }

    if (sub.marketingOptIn === true) {
      tally.marketingOptIns += 1;
    }
  });

  Object.keys(interestSums).forEach(topic => {
    tally.interestAverages[topic] = +(interestSums[topic] / interestCounts[topic]).toFixed(2);
  });

  return new Response(JSON.stringify(tally, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
