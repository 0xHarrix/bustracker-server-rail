const DeviceToken = require("../../modules/notifications/device-token.model");

const sendViaFcmLegacy = async ({ tokens, title, body, data }) => {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey || tokens.length === 0) {
    return { sent: 0, skipped: tokens.length };
  }

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${serverKey}`
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title, body },
      data: data || {}
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FCM request failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  return {
    sent: result.success || 0,
    failed: result.failure || 0
  };
};

const sendPushToUsers = async ({ userIds, title, body, data }) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  const provider = process.env.PUSH_PROVIDER || "none";
  const tokens = await DeviceToken.find({
    userId: { $in: userIds },
    isActive: true
  })
    .select("token")
    .lean();

  const rawTokens = tokens.map((item) => item.token).filter(Boolean);

  if (rawTokens.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  if (provider === "fcm_legacy") {
    return sendViaFcmLegacy({ tokens: rawTokens, title, body, data });
  }

  return { sent: 0, skipped: rawTokens.length };
};

module.exports = {
  sendPushToUsers
};
