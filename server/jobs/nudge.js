const Host = require('../models/Host');
const Trip = require('../models/Trip');
const TollTransaction = require('../models/TollTransaction');
const { sendNudge } = require('../services/email');

// Send a one-time "get started" nudge to users who signed up but never uploaded anything.
// Targets users who:
//   - Created between 24h and 7 days ago
//   - Have access (free trial or active/trialing subscription)
//   - Have zero trips AND zero toll transactions
//   - Have not been sent this nudge yet
async function runNudgeJob() {
  const now = new Date();
  const windowStart = new Date(now - 7 * 24 * 60 * 60 * 1000);  // 7 days ago
  const windowEnd   = new Date(now - 24 * 60 * 60 * 1000);       // 24 hours ago

  const candidates = await Host.find({
    createdAt: { $gte: windowStart, $lte: windowEnd },
    nudge_sent_at: null,
    $or: [
      { subscription_status: { $in: ['active', 'trialing'] } },
      { free_trial_ends_at: { $gt: now } },
    ],
  }).lean();

  if (!candidates.length) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  for (const host of candidates) {
    const [tripCount, tollCount] = await Promise.all([
      Trip.countDocuments({ host_id: host._id }),
      TollTransaction.countDocuments({ host_id: host._id }),
    ]);

    if (tripCount > 0 || tollCount > 0) {
      skipped++;
      continue;
    }

    try {
      const trialEndsAt = host.free_trial_ends_at || null;
      await sendNudge(host.email, host.name, trialEndsAt);
      await Host.updateOne({ _id: host._id }, { nudge_sent_at: now });
      sent++;
      console.log(`[nudge] Sent to ${host.email}`);
    } catch (err) {
      console.error(`[nudge] Failed for ${host.email}:`, err.message);
    }
  }

  console.log(`[nudge] Done — sent: ${sent}, skipped (already uploaded): ${skipped}`);
  return { sent, skipped };
}

module.exports = { runNudgeJob };
