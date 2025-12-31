// node-fetch is used to send HTTP requests from Node.js
// This is an alternative to axios and works well with Meta (Facebook) APIs
import fetch from "node-fetch";

// Function to send a text message from a Facebook Page to a user
export const sendFacebookMessage = async (
  recipientId: string,   // The user's PSID (Page Scoped ID)
  messageText: string    // The text message to send
): Promise<void> => {
  try {
    // Facebook Graph API endpoint for sending messages
    // "me/messages" means the message is sent from the Page itself
    // The Page Access Token is required for authorization
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
      {
        method: "POST", // POST request because we are sending data
        headers: {
          "Content-Type": "application/json", // Request body is JSON
        },

        // Facebook requires a specific message structure
        body: JSON.stringify({
          recipient: {
            id: recipientId, // PSID of the customer
          },
          message: {
            text: messageText, // Message text to be delivered
          },
        }),
      }
    );

    // Parse the JSON response from Facebook API
    const data = await response.json();

    // If Facebook returns an error response
    if (!response.ok) {
      console.error("Facebook API Error:", data);
      throw new Error("Failed to send message");
    }

    // Log success response for debugging
    console.log("Facebook message sent successfully:", data);
  } catch (error) {
    // Catch and log any network or API-related errors
    console.error("Send Facebook Message Error:", error);
  }
};


/* extra code
import axios from "axios";

export const getFacebookUserName = async (
  psid: string,
  pageAccessToken: string
): Promise<string> => {
  try {
    const res = await axios.get(`https://graph.facebook.com/v19.0/${psid}`, {
      params: {
        fields: "name",
        access_token: pageAccessToken,
      },
    });

    return res.data?.name || psid;
  } catch (error) {
    console.error("Failed to fetch Facebook user name:", error);
    return psid;
  }
};

*/


import axios from "axios";

export async function getFacebookUserName(
  psid: string,
  pageAccessToken: string
): Promise<string> {
  if (!pageAccessToken) {
    console.log("❌ FACEBOOK_PAGE_ACCESS_TOKEN missing in .env");
    return psid;
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${psid}`;
    const res = await axios.get(url, {
      params: {
        fields: "name,first_name,last_name",
        access_token: pageAccessToken,
      },
    });

    const name =
      res.data?.name ||
      [res.data?.first_name, res.data?.last_name].filter(Boolean).join(" ");

    console.log("✅ FB NAME FETCH OK:", psid, "->", name);
    return name || psid;
  } catch (error: any) {
    console.log("❌ FB NAME FETCH FAILED for:", psid);
    console.log("Status:", error?.response?.status);
    console.log("Data:", error?.response?.data || error?.message);
    return psid; // fallback
  }
}
