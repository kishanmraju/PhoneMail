const Email = require("../models/Email");
const User = require("../models/User");

const sendEmail = async (req, res) => {
  try {
    const {
      recipients,
      cc,
      subject,
      body,
      threadId
    } = req.body;

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({
        message: "At least one recipient is required"
      });
    }

    if (!body) {
      return res.status(400).json({
        message: "Email body is required"
      });
    }

    // Remove duplicate recipients
    const uniqueRecipients = [...new Set(recipients)];

    // Check that all recipients are PhoneMail users
    const users = await User.find(
      {
        phoneNumber: {
          $in: uniqueRecipients
        }
      },
      {
        phoneNumber: 1
      }
    );

    const registeredNumbers = new Set(
      users.map(user => user.phoneNumber)
    );

    const invalidRecipients = uniqueRecipients.filter(
      number => !registeredNumbers.has(number)
    );

    if (invalidRecipients.length > 0) {
      return res.status(400).json({
        message:
          "This (or) Some of these recipients are not registered on PhoneMail",
        invalidRecipients
      });
    }

    const sender = req.user.phoneNumber;

    // One thread ID shared by sender + recipients
    const emailThreadId =
      threadId || Date.now().toString();

    // --------------------------------
    // CREATE SENDER'S SENT COPY
    // --------------------------------

    const sentEmail = await Email.create({
      sender,
      recipients: uniqueRecipients,
      cc: cc || [],
      subject: subject || "",
      body,
      threadId: emailThreadId,
      folder: "sent",
      isRead: true
    });

    // --------------------------------
    // CREATE RECIPIENT'S INBOX COPY
    // --------------------------------

    const inboxEmails = uniqueRecipients.map(
      recipient => ({
        sender,
        recipients: [recipient],
        cc: cc || [],
        subject: subject || "",
        body,
        threadId: emailThreadId,
        folder: "inbox",
        isRead: false
      })
    );

    await Email.insertMany(inboxEmails);

    // --------------------------------
    // RESPONSE
    // --------------------------------

    res.status(201).json({
      message: "Email sent successfully",
      email: sentEmail
    });

  } catch (error) {
    console.error("Send email error:", error);

    res.status(500).json({
      message: "Failed to send email"
    });
  }
};

const getEmails = async (req, res) => {
  try {
    const phoneNumber = req.user.phoneNumber;

    const { unread, favorites } = req.query;

    let filter;

    // ⭐ FAVORITES
    if (favorites === "true") {
      filter = {
        isFavorite: true,
        $or: [
          { recipients: phoneNumber },
          { sender: phoneNumber }
        ]
      };
    }

    // 📖 UNREAD
    else if (unread === "true") {
      filter = {
        recipients: phoneNumber,
        sender: { $ne: phoneNumber },
        folder: "inbox",
        isRead: false
      };
    }

    // 📥 NORMAL INBOX
    else {
      filter = {
        recipients: phoneNumber,
        sender: { $ne: phoneNumber },
        folder: "inbox"
      };
    }

    const emails = await Email.find(filter)
      .sort({ createdAt: -1 });

    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error("Get emails error:", error);

    res.status(500).json({
      message: "Failed to fetch emails"
    });
  }
};


const getEmailById = async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);

    if (!email) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    res.status(200).json({
      email
    });

  } catch (error) {
    console.error("Get email error:", error);

    res.status(500).json({
      message: "Failed to fetch email"
    });
  }
};



const getConversation = async (req, res) => {
  try {
    const { threadId } = req.params;
    const phoneNumber = req.user.phoneNumber;

    const emails = await Email.find({
      threadId,
      $or: [
        {
          sender: phoneNumber,
          folder: {
            $in: ["sent", "trash", "spam"]
          }
        },
        {
          recipients: phoneNumber,
          folder: {
            $in: ["inbox", "trash", "spam"]
          }
        },
        {
          cc: phoneNumber,
          folder: {
            $in: ["inbox", "trash", "spam"]
          }
        }
      ]
    }).sort({ createdAt: 1 });

    if (emails.length === 0) {
      return res.status(404).json({
        message: "Conversation not found"
      });
    }

    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error("Get conversation error:", error);

    res.status(500).json({
      message: "Failed to fetch conversation"
    });
  }
};


const replyToEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body;

    if (!body) {
      return res.status(400).json({
        message: "Reply body is required"
      });
    }

    const originalEmail = await Email.findById(id);

    if (!originalEmail) {
      return res.status(404).json({
        message: "Original email not found"
      });
    }

    if (originalEmail.hasReplied) {
      return res.status(400).json({
        message: "This email has already been replied to"
      });
    }

    const currentUser = req.user.phoneNumber;
    const recipient = originalEmail.sender;

    const replySubject = originalEmail.subject.startsWith("Re:")
      ? originalEmail.subject
      : `Re: ${originalEmail.subject}`;

    // Sender's copy
    const reply = await Email.create({
      sender: currentUser,
      recipients: [recipient],
      subject: replySubject,
      body,
      threadId: originalEmail.threadId,
      folder: "sent",
      isRead: true
    });

    // Recipient's copy
    await Email.create({
      sender: currentUser,
      recipients: [recipient],
      subject: replySubject,
      body,
      threadId: originalEmail.threadId,
      folder: "inbox",
      isRead: false
    });

    originalEmail.hasReplied = true;
    await originalEmail.save();

    res.status(201).json({
      message: "Reply sent successfully",
      email: reply
    });

  } catch (error) {
    console.error("Reply error:", error);

    res.status(500).json({
      message: "Failed to send reply"
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    email.isRead = true;

    await email.save();

    res.status(200).json({
      message: "Email marked as read",
      email
    });

  } catch (error) {
    console.error("Mark as read error:", error);

    res.status(500).json({
      message: "Failed to mark email as read"
    });
  }
};


const toggleFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    // ? THIS IS THE HIGHLIGHT. THIS IS A FREAKING TOGGLE :O
    email.isFavorite = !email.isFavorite;

    await email.save();

    res.status(200).json({
      message: email.isFavorite
        ? "Email added to favorites"
        : "Email removed from favorites",
      email
    });

  } catch (error) {
    console.error("Toggle favorite error:", error);

    res.status(500).json({
      message: "Failed to update favorite"
    });
  }
};


const getSentEmails = async (req, res) => {
  try {
    const phoneNumber = req.user.phoneNumber;

    const emails = await Email.find({
      sender: phoneNumber,
      folder: "sent"
    }).sort({ createdAt: -1 });

    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error("Get sent emails error:", error);

    res.status(500).json({
      message: "Failed to fetch sent emails"
    });
  }
};



const createDraft = async (req, res) => {
  try {
    const { recipients, subject, body } = req.body;

    const phoneNumber = req.user.phoneNumber;

    const draft = await Email.create({
      sender: phoneNumber,

      recipients: recipients || [],

      subject: subject || "",

      body: body || "",

      threadId: `draft-${Date.now()}`,

      folder: "draft"
    });

    res.status(201).json({
      message: "Draft saved successfully",
      draft
    });

  } catch (error) {
    console.error("Create draft error:", error);

    res.status(500).json({
      message: "Failed to save draft",
      error: error.message
    });
  }
};


const getDrafts = async (req, res) => {
  try {
    const phoneNumber = req.user.phoneNumber;

    const drafts = await Email.find({
      sender: phoneNumber,
      folder: "draft"
    }).sort({ createdAt: -1 });

    res.status(200).json({
      emails: drafts
    });

  } catch (error) {
    console.error("Get drafts error:", error);

    res.status(500).json({
      message: "Failed to fetch drafts"
    });
  }
};



const moveToTrash = async (req, res) => {
  try {
    const { id } = req.params;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    email.folder = "trash";

    await email.save();

    res.status(200).json({
      message: "Email moved to trash",
      email
    });

  } catch (error) {
    console.error("Move to trash error:", error);

    res.status(500).json({
      message: "Failed to move email to trash"
    });
  }
};




const getTrash = async (req, res) => {
  try {
    const phoneNumber = req.user.phoneNumber;

    const emails = await Email.find({
      recipients: phoneNumber,
      folder: "trash"
    }).sort({ createdAt: -1 });

    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error("Get trash error:", error);

    res.status(500).json({
      message: "Failed to fetch trash"
    });
  }
};



const moveToSpam = async (req, res) => {
  try {
    const { id } = req.params;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    email.folder = "spam";

    await email.save();

    res.status(200).json({
      message: "Email moved to spam",
      email
    });

  } catch (error) {
    console.error("Move to spam error:", error);

    res.status(500).json({
      message: "Failed to move email to spam"
    });
  }
};



const getSpam = async (req, res) => {
  try {
    const phoneNumber = req.user.phoneNumber;

    const emails = await Email.find({
      recipients: phoneNumber,
      folder: "spam"
    }).sort({ createdAt: -1 });

    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error("Get spam error:", error);

    res.status(500).json({
      message: "Failed to fetch spam"
    });
  }
};


const restoreEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    if (email.folder !== "trash" && email.folder !== "spam") {
      return res.status(400).json({
        message: "Only emails in trash or spam can be restored"
      });
    }

    email.folder = "inbox";

    await email.save();

    res.status(200).json({
      message: "Email restored successfully",
      email
    });

  } catch (error) {
    console.error("Restore email error:", error);

    res.status(500).json({
      message: "Failed to restore email"
    });
  }
};


const permanentlyDeleteEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const email = await Email.findById(id);

    if (!email) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    if (email.folder !== "trash") {
      return res.status(400).json({
        message: "Only emails in trash can be permanently deleted"
      });
    }

    await Email.findByIdAndDelete(id);

    res.status(200).json({
      message: "Email permanently deleted"
    });

  } catch (error) {
    console.error("Permanent delete error:", error);

    res.status(500).json({
      message: "Failed to permanently delete email"
    });
  }
};


const sendDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipients, subject, body } = req.body;

    const sender = req.user.phoneNumber;

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({
        message: "At least one recipient is required"
      });
    }

    if (!body) {
      return res.status(400).json({
        message: "Email body is required"
      });
    }

    const draft = await Email.findOne({
      _id: id,
      sender,
      folder: "draft"
    });

    if (!draft) {
      return res.status(404).json({
        message: "Draft not found"
      });
    }

    const uniqueRecipients = [...new Set(recipients)];

    // Make sure recipients are PhoneMail users
    const users = await User.find({
      phoneNumber: {
        $in: uniqueRecipients
      }
    });

    const registeredNumbers = new Set(
      users.map(user => user.phoneNumber)
    );

    const invalidRecipients = uniqueRecipients.filter(
      number => !registeredNumbers.has(number)
    );

    if (invalidRecipients.length > 0) {
      return res.status(400).json({
        message: "Some recipients are not registered on PhoneMail",
        invalidRecipients
      });
    }

    const threadId = Date.now().toString();

    // Update draft → sent
    draft.recipients = uniqueRecipients;
    draft.subject = subject || "";
    draft.body = body;
    draft.threadId = threadId;
    draft.folder = "sent";
    draft.isRead = true;

    await draft.save();

    // Create inbox copies
    const inboxEmails = uniqueRecipients.map(recipient => ({
      sender,
      recipients: [recipient],
      subject: subject || "",
      body,
      threadId,
      folder: "inbox",
      isRead: false
    }));

    await Email.insertMany(inboxEmails);

    res.status(200).json({
      message: "Draft sent successfully",
      email: draft
    });

  } catch (error) {
    console.error("Send draft error:", error);

    res.status(500).json({
      message: "Failed to send draft"
    });
  }
};



module.exports = { sendEmail, getEmails, getEmailById, getConversation, replyToEmail, markAsRead, toggleFavorite, getSentEmails, createDraft, getDrafts, moveToTrash, getTrash, moveToSpam, getSpam, restoreEmail, permanentlyDeleteEmail, sendDraft };