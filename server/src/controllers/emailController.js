const Email = require("../models/Email");
const User = require("../models/User");
const crypto = require("crypto");


// ==========================================
// CHECK WHETHER USER CAN ACCESS EMAIL
// ==========================================

const userCanAccessEmail = (email, phoneNumber) => {
  if (!email) {
    return false;
  }

  // Sender
  if (email.sender === phoneNumber) {
    return true;
  }

  // Recipient
  if (
    email.recipients &&
    email.recipients.includes(phoneNumber)
  ) {
    return true;
  }

  // CC
  if (
    email.cc &&
    email.cc.includes(phoneNumber)
  ) {
    return true;
  }

  return false;
};


// ==========================================
// SEND EMAIL
// ==========================================

const sendEmail = async (req, res) => {
  try {
    const {
      recipients,
      cc,
      subject,
      body,
      threadId
    } = req.body;


    // --------------------------------
    // VALIDATION
    // --------------------------------

    if (
      !recipients ||
      !Array.isArray(recipients) ||
      recipients.length === 0
    ) {
      return res.status(400).json({
        message: "At least one recipient is required"
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        message: "Email body is required"
      });
    }


    // --------------------------------
    // REMOVE DUPLICATE RECIPIENTS
    // --------------------------------

    const uniqueRecipients = [
      ...new Set(recipients)
    ];


    // --------------------------------
    // REMOVE DUPLICATE CC
    // --------------------------------

    const uniqueCC = [
      ...new Set(cc || [])
    ];


    // --------------------------------
    // CHECK TO / CC OVERLAP
    // --------------------------------

    const overlappingRecipients =
      uniqueRecipients.filter(
        number =>
          uniqueCC.includes(number)
      );

    if (
      overlappingRecipients.length > 0
    ) {
      return res.status(400).json({
        message:
          "A recipient cannot appear in both To and CC",

        overlappingRecipients
      });
    }


    // --------------------------------
    // CHECK THAT RECIPIENTS EXIST
    // --------------------------------

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


    const registeredNumbers =
      new Set(
        users.map(
          user => user.phoneNumber
        )
      );


    const invalidRecipients =
      uniqueRecipients.filter(
        number =>
          !registeredNumbers.has(number)
      );


    if (
      invalidRecipients.length > 0
    ) {
      return res.status(400).json({
        message:
          "This (or) Some of these recipients are not registered on PhoneMail",

        invalidRecipients
      });
    }


    // --------------------------------
    // CHECK THAT CC USERS EXIST
    // --------------------------------

    if (uniqueCC.length > 0) {
      const ccUsers = await User.find(
        {
          phoneNumber: {
            $in: uniqueCC
          }
        },
        {
          phoneNumber: 1
        }
      );


      const registeredCCNumbers =
        new Set(
          ccUsers.map(
            user => user.phoneNumber
          )
        );


      const invalidCC =
        uniqueCC.filter(
          number =>
            !registeredCCNumbers.has(
              number
            )
        );


      if (invalidCC.length > 0) {
        return res.status(400).json({
          message:
            "Some CC recipients are not registered on PhoneMail",

          invalidCC
        });
      }
    }


    // --------------------------------
    // SENDER
    // --------------------------------

    const sender =
      req.user.phoneNumber;


    // --------------------------------
    // THREAD ID
    // --------------------------------

    const emailThreadId =
      threadId ||
      crypto.randomUUID();


    // --------------------------------
    // CREATE SENDER'S SENT COPY
    // --------------------------------

    const sentEmail =
      await Email.create({
        sender,

        recipients:
          uniqueRecipients,

        cc:
          uniqueCC,

        subject:
          subject || "",

        body:
          body.trim(),

        threadId:
          emailThreadId,

        folder:
          "sent",

        isRead:
          true
      });


    // --------------------------------
    // CREATE RECIPIENT INBOX COPIES
    // --------------------------------

    const inboxEmails =
      uniqueRecipients.map(
        recipient => ({
          sender,

          recipients: [
            recipient
          ],

          cc:
            uniqueCC,

          subject:
            subject || "",

          body:
            body.trim(),

          threadId:
            emailThreadId,

          folder:
            "inbox",

          isRead:
            false
        })
      );


    await Email.insertMany(
      inboxEmails
    );


    // --------------------------------
    // RESPONSE
    // --------------------------------

    res.status(201).json({
      message:
        "Email sent successfully",

      email:
        sentEmail
    });

  } catch (error) {
    console.error(
      "Send email error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to send email"
    });
  }
};


// ==========================================
// GET EMAILS
// ==========================================

const getEmails = async (req, res) => {
  try {
    const phoneNumber =
      req.user.phoneNumber;

    const {
      unread,
      favorites
    } = req.query;

    let filter;


    // --------------------------------
    // FAVORITES
    // --------------------------------

    if (
      favorites === "true"
    ) {
      filter = {
        isFavorite: true,

        $or: [
          {
            recipients:
              phoneNumber
          },
          {
            cc:
              phoneNumber
          },
          {
            sender:
              phoneNumber
          }
        ]
      };
    }


    // --------------------------------
    // UNREAD
    // --------------------------------

    else if (
      unread === "true"
    ) {
      filter = {
        recipients:
          phoneNumber,

        sender: {
          $ne:
            phoneNumber
        },

        folder:
          "inbox",

        isRead:
          false
      };
    }


    // --------------------------------
    // NORMAL INBOX
    // --------------------------------

    else {
      filter = {
        recipients:
          phoneNumber,

        sender: {
          $ne:
            phoneNumber
        },

        folder:
          "inbox"
      };
    }


    const emails =
      await Email.find(filter)
        .sort({
          createdAt:
            -1
        });


    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error(
      "Get emails error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch emails"
    });
  }
};


// ==========================================
// GET EMAIL BY ID
// ==========================================

const getEmailById = async (
  req,
  res
) => {
  try {
    const email =
      await Email.findById(
        req.params.id
      );


    if (!email) {
      return res.status(404).json({
        message:
          "Email not found"
      });
    }


    const phoneNumber =
      req.user.phoneNumber;


    if (
      !userCanAccessEmail(
        email,
        phoneNumber
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    res.status(200).json({
      email
    });

  } catch (error) {
    console.error(
      "Get email error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch email"
    });
  }
};


// ==========================================
// GET CONVERSATION
// ==========================================

const getConversation = async (
  req,
  res
) => {
  try {
    const {
      threadId
    } = req.params;

    const phoneNumber =
      req.user.phoneNumber;


    const emails =
      await Email.find({
        threadId,

        $or: [
          {
            sender:
              phoneNumber,

            folder: {
              $in: [
                "sent",
                "trash",
                "spam"
              ]
            }
          },

          {
            recipients:
              phoneNumber,

            folder: {
              $in: [
                "inbox",
                "trash",
                "spam"
              ]
            }
          },

          {
            cc:
              phoneNumber,

            folder: {
              $in: [
                "inbox",
                "trash",
                "spam"
              ]
            }
          }
        ]
      }).sort({
        createdAt:
          1
      });


    if (
      emails.length === 0
    ) {
      return res.status(404).json({
        message:
          "Conversation not found"
      });
    }


    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error(
      "Get conversation error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch conversation"
    });
  }
};


// ==========================================
// REPLY TO EMAIL
// ==========================================

const replyToEmail = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;

    const {
      body
    } = req.body;


    if (
      !body ||
      !body.trim()
    ) {
      return res.status(400).json({
        message:
          "Reply body is required"
      });
    }


    const originalEmail =
      await Email.findById(id);


    if (!originalEmail) {
      return res.status(404).json({
        message:
          "Original email not found"
      });
    }


    const currentUser =
      req.user.phoneNumber;


    // --------------------------------
    // CHECK ACCESS
    // --------------------------------

    if (
      !userCanAccessEmail(
        originalEmail,
        currentUser
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    // --------------------------------
    // CHECK IF ALREADY REPLIED
    // --------------------------------

    if (
      originalEmail.hasReplied
    ) {
      return res.status(400).json({
        message:
          "This email has already been replied to"
      });
    }


    // --------------------------------
    // ORIGINAL SENDER
    // --------------------------------

    const recipient =
      originalEmail.sender;


    // --------------------------------
    // DON'T REPLY TO YOURSELF
    // --------------------------------

    if (
      recipient === currentUser
    ) {
      return res.status(400).json({
        message:
          "You cannot reply to yourself"
      });
    }


    // --------------------------------
    // REPLY SUBJECT
    // --------------------------------

    const replySubject =
      originalEmail.subject &&
      originalEmail.subject.startsWith(
        "Re:"
      )
        ? originalEmail.subject
        : originalEmail.subject
          ? `Re: ${originalEmail.subject}`
          : "Re:";


    // --------------------------------
    // CREATE SENT REPLY
    // --------------------------------

    const reply =
      await Email.create({
        sender:
          currentUser,

        recipients: [
          recipient
        ],

        subject:
          replySubject,

        body:
          body.trim(),

        threadId:
          originalEmail.threadId,

        folder:
          "sent",

        isRead:
          true
      });


    // --------------------------------
    // CREATE RECIPIENT INBOX COPY
    // --------------------------------

    await Email.create({
      sender:
        currentUser,

      recipients: [
        recipient
      ],

      subject:
        replySubject,

      body:
        body.trim(),

      threadId:
        originalEmail.threadId,

      folder:
        "inbox",

      isRead:
        false
    });


    // --------------------------------
    // MARK ORIGINAL AS REPLIED
    // --------------------------------

    originalEmail.hasReplied =
      true;

    await originalEmail.save();


    res.status(201).json({
      message:
        "Reply sent successfully",

      email:
        reply
    });

  } catch (error) {
    console.error(
      "Reply error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to send reply"
    });
  }
};


// ==========================================
// MARK EMAIL AS READ
// ==========================================

const markAsRead = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;


    const email =
      await Email.findById(id);


    if (!email) {
      return res.status(404).json({
        message:
          "Email not found"
      });
    }


    const phoneNumber =
      req.user.phoneNumber;


    if (
      !userCanAccessEmail(
        email,
        phoneNumber
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    email.isRead =
      true;


    await email.save();


    res.status(200).json({
      message:
        "Email marked as read",

      email
    });

  } catch (error) {
    console.error(
      "Mark as read error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to mark email as read"
    });
  }
};


// ==========================================
// TOGGLE FAVORITE
// ==========================================

const toggleFavorite = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;


    const email =
      await Email.findById(id);


    if (!email) {
      return res.status(404).json({
        message:
          "Email not found"
      });
    }


    const phoneNumber =
      req.user.phoneNumber;


    if (
      !userCanAccessEmail(
        email,
        phoneNumber
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    email.isFavorite =
      !email.isFavorite;


    await email.save();


    res.status(200).json({
      message:
        email.isFavorite
          ? "Email added to favorites"
          : "Email removed from favorites",

      email
    });

  } catch (error) {
    console.error(
      "Toggle favorite error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to update favorite"
    });
  }
};


// ==========================================
// GET SENT EMAILS
// ==========================================

const getSentEmails = async (
  req,
  res
) => {
  try {
    const phoneNumber =
      req.user.phoneNumber;


    const emails =
      await Email.find({
        sender:
          phoneNumber,

        folder:
          "sent"
      }).sort({
        createdAt:
          -1
      });


    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error(
      "Get sent emails error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch sent emails"
    });
  }
};


// ==========================================
// CREATE DRAFT
// ==========================================

const createDraft = async (
  req,
  res
) => {
  try {
    const {
      recipients,
      cc,
      subject,
      body
    } = req.body;


    const phoneNumber =
      req.user.phoneNumber;


    const uniqueRecipients =
      Array.isArray(recipients)
        ? [...new Set(recipients)]
        : [];


    const uniqueCC =
      Array.isArray(cc)
        ? [...new Set(cc)]
        : [];


    const draft =
      await Email.create({
        sender:
          phoneNumber,

        recipients:
          uniqueRecipients,

        cc:
          uniqueCC,

        subject:
          subject || "",

        body:
          body || "",

        threadId:
          `draft-${crypto.randomUUID()}`,

        folder:
          "draft"
      });


    res.status(201).json({
      message:
        "Draft saved successfully",

      draft
    });

  } catch (error) {
    console.error(
      "Create draft error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to save draft",

      error:
        error.message
    });
  }
};


// ==========================================
// GET DRAFTS
// ==========================================

const getDrafts = async (
  req,
  res
) => {
  try {
    const phoneNumber =
      req.user.phoneNumber;


    const drafts =
      await Email.find({
        sender:
          phoneNumber,

        folder:
          "draft"
      }).sort({
        createdAt:
          -1
      });


    res.status(200).json({
      emails:
        drafts
    });

  } catch (error) {
    console.error(
      "Get drafts error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch drafts"
    });
  }
};


// ==========================================
// MOVE EMAIL TO TRASH
// ==========================================

const moveToTrash = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;


    const email =
      await Email.findById(id);


    if (!email) {
      return res.status(404).json({
        message:
          "Email not found"
      });
    }


    const phoneNumber =
      req.user.phoneNumber;


    if (
      !userCanAccessEmail(
        email,
        phoneNumber
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    email.folder =
      "trash";


    await email.save();


    res.status(200).json({
      message:
        "Email moved to trash",

      email
    });

  } catch (error) {
    console.error(
      "Move to trash error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to move email to trash"
    });
  }
};


// ==========================================
// GET TRASH
// ==========================================

const getTrash = async (
  req,
  res
) => {
  try {
    const phoneNumber =
      req.user.phoneNumber;


    const emails =
      await Email.find({
        $or: [
          {
            recipients:
              phoneNumber
          },
          {
            cc:
              phoneNumber
          }
        ],

        folder:
          "trash"
      }).sort({
        createdAt:
          -1
      });


    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error(
      "Get trash error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch trash"
    });
  }
};


// ==========================================
// MOVE EMAIL TO SPAM
// ==========================================

const moveToSpam = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;


    const email =
      await Email.findById(id);


    if (!email) {
      return res.status(404).json({
        message:
          "Email not found"
      });
    }


    const phoneNumber =
      req.user.phoneNumber;


    if (
      !userCanAccessEmail(
        email,
        phoneNumber
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    email.folder =
      "spam";


    await email.save();


    res.status(200).json({
      message:
        "Email moved to spam",

      email
    });

  } catch (error) {
    console.error(
      "Move to spam error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to move email to spam"
    });
  }
};


// ==========================================
// GET SPAM
// ==========================================

const getSpam = async (
  req,
  res
) => {
  try {
    const phoneNumber =
      req.user.phoneNumber;


    const emails =
      await Email.find({
        $or: [
          {
            recipients:
              phoneNumber
          },
          {
            cc:
              phoneNumber
          }
        ],

        folder:
          "spam"
      }).sort({
        createdAt:
          -1
      });


    res.status(200).json({
      emails
    });

  } catch (error) {
    console.error(
      "Get spam error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to fetch spam"
    });
  }
};


// ==========================================
// RESTORE EMAIL
// ==========================================

const restoreEmail = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;


    const email =
      await Email.findById(id);


    if (!email) {
      return res.status(404).json({
        message:
          "Email not found"
      });
    }


    const phoneNumber =
      req.user.phoneNumber;


    if (
      !userCanAccessEmail(
        email,
        phoneNumber
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    if (
      email.folder !== "trash" &&
      email.folder !== "spam"
    ) {
      return res.status(400).json({
        message:
          "Only emails in trash or spam can be restored"
      });
    }


    email.folder =
      "inbox";


    await email.save();


    res.status(200).json({
      message:
        "Email restored successfully",

      email
    });

  } catch (error) {
    console.error(
      "Restore email error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to restore email"
    });
  }
};


// ==========================================
// PERMANENTLY DELETE EMAIL
// ==========================================

const permanentlyDeleteEmail = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;


    const email =
      await Email.findById(id);


    if (!email) {
      return res.status(404).json({
        message:
          "Email not found"
      });
    }


    const phoneNumber =
      req.user.phoneNumber;


    if (
      !userCanAccessEmail(
        email,
        phoneNumber
      )
    ) {
      return res.status(403).json({
        message:
          "Access denied"
      });
    }


    if (
      email.folder !== "trash"
    ) {
      return res.status(400).json({
        message:
          "Only emails in trash can be permanently deleted"
      });
    }


    await Email.findByIdAndDelete(
      id
    );


    res.status(200).json({
      message:
        "Email permanently deleted"
    });

  } catch (error) {
    console.error(
      "Permanent delete error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to permanently delete email"
    });
  }
};


// ==========================================
// SEND DRAFT
// ==========================================

const sendDraft = async (
  req,
  res
) => {
  try {
    const {
      id
    } = req.params;


    const {
      recipients,
      cc,
      subject,
      body
    } = req.body;


    const sender =
      req.user.phoneNumber;


    // --------------------------------
    // VALIDATION
    // --------------------------------

    if (
      !recipients ||
      !Array.isArray(recipients) ||
      recipients.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one recipient is required"
      });
    }


    if (
      !body ||
      !body.trim()
    ) {
      return res.status(400).json({
        message:
          "Email body is required"
      });
    }


    // --------------------------------
    // FIND DRAFT
    // --------------------------------

    const draft =
      await Email.findOne({
        _id:
          id,

        sender:
          sender,

        folder:
          "draft"
      });


    if (!draft) {
      return res.status(404).json({
        message:
          "Draft not found"
      });
    }


    // --------------------------------
    // UNIQUE RECIPIENTS
    // --------------------------------

    const uniqueRecipients =
      [
        ...new Set(
          recipients
        )
      ];


    // --------------------------------
    // UNIQUE CC
    // --------------------------------

    const uniqueCC =
      [
        ...new Set(
          cc || []
        )
      ];


    // --------------------------------
    // CHECK TO / CC OVERLAP
    // --------------------------------

    const overlappingRecipients =
      uniqueRecipients.filter(
        number =>
          uniqueCC.includes(
            number
          )
      );


    if (
      overlappingRecipients.length > 0
    ) {
      return res.status(400).json({
        message:
          "A recipient cannot appear in both To and CC",

        overlappingRecipients
      });
    }


    // --------------------------------
    // CHECK RECIPIENTS
    // --------------------------------

    const users =
      await User.find({
        phoneNumber: {
          $in:
            uniqueRecipients
        }
      });


    const registeredNumbers =
      new Set(
        users.map(
          user =>
            user.phoneNumber
        )
      );


    const invalidRecipients =
      uniqueRecipients.filter(
        number =>
          !registeredNumbers.has(
            number
          )
      );


    if (
      invalidRecipients.length > 0
    ) {
      return res.status(400).json({
        message:
          "Some recipients are not registered on PhoneMail",

        invalidRecipients
      });
    }


    // --------------------------------
    // CHECK CC USERS
    // --------------------------------

    if (
      uniqueCC.length > 0
    ) {
      const ccUsers =
        await User.find({
          phoneNumber: {
            $in:
              uniqueCC
          }
        });


      const registeredCCNumbers =
        new Set(
          ccUsers.map(
            user =>
              user.phoneNumber
          )
        );


      const invalidCC =
        uniqueCC.filter(
          number =>
            !registeredCCNumbers.has(
              number
            )
        );


      if (
        invalidCC.length > 0
      ) {
        return res.status(400).json({
          message:
            "Some CC recipients are not registered on PhoneMail",

          invalidCC
        });
      }
    }


    // --------------------------------
    // CREATE NEW THREAD ID
    // --------------------------------

    const threadId =
      crypto.randomUUID();


    // --------------------------------
    // UPDATE DRAFT → SENT
    // --------------------------------

    draft.recipients =
      uniqueRecipients;

    draft.cc =
      uniqueCC;

    draft.subject =
      subject || "";

    draft.body =
      body.trim();

    draft.threadId =
      threadId;

    draft.folder =
      "sent";

    draft.isRead =
      true;


    await draft.save();


    // --------------------------------
    // CREATE INBOX COPIES
    // --------------------------------

    const inboxEmails =
      uniqueRecipients.map(
        recipient => ({
          sender,

          recipients: [
            recipient
          ],

          cc:
            uniqueCC,

          subject:
            subject || "",

          body:
            body.trim(),

          threadId,

          folder:
            "inbox",

          isRead:
            false
        })
      );


    await Email.insertMany(
      inboxEmails
    );


    // --------------------------------
    // RESPONSE
    // --------------------------------

    res.status(200).json({
      message:
        "Draft sent successfully",

      email:
        draft
    });

  } catch (error) {
    console.error(
      "Send draft error:",
      error
    );

    res.status(500).json({
      message:
        "Failed to send draft"
    });
  }
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  sendEmail,
  getEmails,
  getEmailById,
  getConversation,
  replyToEmail,
  markAsRead,
  toggleFavorite,
  getSentEmails,
  createDraft,
  getDrafts,
  moveToTrash,
  getTrash,
  moveToSpam,
  getSpam,
  restoreEmail,
  permanentlyDeleteEmail,
  sendDraft
};