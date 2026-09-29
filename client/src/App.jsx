import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const MSG91_WIDGET_ID = import.meta.env.VITE_MSG91_WIDGET_ID;

const MSG91_WIDGET_TOKEN = import.meta.env.VITE_MSG91_WIDGET_TOKEN;

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const [screen, setScreen] = useState(() => {
    const savedToken = localStorage.getItem("token");
    return savedToken ? 5 : 1;
  });

  const [accepted, setAccepted] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");

  const [msg91ReqId, setMsg91ReqId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [emails, setEmails] = useState([]);
  const [view, setView] = useState("inbox");

  const [unreadCount, setUnreadCount] = useState(0);

  const [searchPhone, setSearchPhone] = useState("");
  const [searchedUser, setSearchedUser] = useState(null);

  const [showCompose, setShowCompose] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editingDraft, setEditingDraft] = useState(null);

  const [selectedEmail, setSelectedEmail] = useState(null);
  const [conversation, setConversation] = useState([]);

  const [replyBody, setReplyBody] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");

  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});

  const viewRef = useRef(view);
  const selectedEmailRef = useRef(selectedEmail);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    selectedEmailRef.current =
      selectedEmail;
  }, [selectedEmail]);

  const languages = [
    { name: "English", native: "English" },
    { name: "Tamil", native: "தமிழ்" },
    { name: "Hindi", native: "हिन्दी" },
    { name: "Telugu", native: "తెలుగు" },
    { name: "Kannada", native: "ಕನ್ನಡ" },
  ];

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    if (!MSG91_WIDGET_ID || !MSG91_WIDGET_TOKEN) {
      console.error(
        "MSG91 Widget ID or Widget Token is missing"
      );
      return;
    }

    const initializeMSG91 = () => {
      if (
        typeof window.initSendOTP !== "function"
      ) {
        console.error(
          "MSG91 OTP Widget failed to initialize"
        );
        return;
      }

      if (window.__phoneMailMSG91Initialized) {
        return;
      }

      const configuration = {
        widgetId: MSG91_WIDGET_ID,

        tokenAuth: MSG91_WIDGET_TOKEN,

        exposeMethods: true,

        // captchaRenderId: "",

        success: (data) => {
          console.log(
            "MSG91 success:",
            data
          );
        },

        failure: (error) => {
          console.error(
            "MSG91 failure:",
            error
          );
        }
      };

      window.initSendOTP(
        configuration
      );

      window.__phoneMailMSG91Initialized = true;

      console.log(
        "MSG91 OTP Widget initialized"
      );
    };

    const existingScript =
      document.querySelector(
        'script[src="https://verify.msg91.com/otp-provider.js"]'
      );

    if (existingScript) {
      initializeMSG91();
      return;
    }

    const script =
      document.createElement("script");

    script.src =
      "https://verify.msg91.com/otp-provider.js";

    script.async = true;

    script.onload =
      initializeMSG91;

    script.onerror = () => {
      console.error(
        "Could not load MSG91 OTP Widget"
      );
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  const parseRecipients = (value) => {
    return value
      .split(",")
      .map((number) =>
        number.replace(/\D/g, "").trim()
      )
      .filter(Boolean);
  };

  const clearConversation = () => {
    setSelectedEmail(null);
    setConversation([]);
    setReplyBody("");
  };

  const resetCompose = () => {
    setShowCompose(false);
    setEditingDraft(null);
    setRecipient("");
    setSubject("");
    setBody("");
    setError("");
  };

  // --------------------------------------------------
  // TOAST
  // --------------------------------------------------

  const showToast = (message, icon = "✓") => {
    const id = Date.now() + Math.random();

    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id,
        message,
        icon,
      },
    ]);

    toastTimers.current[id] = setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter(
          (toast) => toast.id !== id
        )
      );

      delete toastTimers.current[id];
    }, 3000);
  };

  // --------------------------------------------------
  // AUTH ERROR
  // --------------------------------------------------

  const handleAuthError = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setScreen(1);

    setEmails([]);
    setConversation([]);
    setSelectedEmail(null);

    setPhoneNumber("");
    setOtp("");

    resetCompose();

    setUnreadCount(0);
    setView("inbox");

    showToast(
      "Session expired. Please login again.",
      "!"
    );
  };

  // --------------------------------------------------
  // OPEN CONVERSATION
  // --------------------------------------------------

  const openConversation = async (email) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/thread/${email.threadId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to fetch conversation"
        );
      }

      setConversation(data.emails || []);
      setSelectedEmail(email);

      // Mark incoming unread email as read
      if (
        !email.isRead &&
        email.sender !== user.phoneNumber
      ) {
        const readResponse = await fetch(
          `${API_URL}/api/emails/${email._id}/read`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (readResponse.status === 401) {
          handleAuthError();
          return;
        }

        if (readResponse.ok) {
          setEmails((currentEmails) => {
            if (view === "unread") {
              return currentEmails.filter(
                (item) =>
                  item._id !== email._id
              );
            }

            return currentEmails.map((item) =>
              item._id === email._id
                ? {
                  ...item,
                  isRead: true,
                }
                : item
            );
          });

          setSelectedEmail((currentEmail) =>
            currentEmail
              ? {
                ...currentEmail,
                isRead: true,
              }
              : currentEmail
          );

          setUnreadCount((currentCount) =>
            Math.max(
              0,
              currentCount - 1
            )
          );
        }
      }
    } catch (error) {
      console.error(
        "Conversation error:",
        error
      );

      showToast(
        error.message ||
        "Failed to open conversation",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // SEND REPLY
  // --------------------------------------------------

  const sendReply = async () => {
    if (!replyBody.trim()) {
      return;
    }

    if (!conversation.length) {
      return;
    }

    /*
      We can only reply to an incoming message.

      Also, every individual message can only
      receive one reply according to the backend.
    */
    const replyTarget = [...conversation]
      .reverse()
      .find(
        (message) =>
          message.sender !==
          user.phoneNumber &&
          !message.hasReplied
      );

    if (!replyTarget) {
      showToast(
        "There is no message available to reply to.",
        "!"
      );

      return;
    }

    try {
      setReplyLoading(true);

      const response = await fetch(
        `${API_URL}/api/emails/${replyTarget._id}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            body: replyBody.trim(),
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to send reply"
        );
      }

      setReplyBody("");

      // Refresh conversation directly
      const conversationResponse =
        await fetch(
          `${API_URL}/api/emails/thread/${selectedEmail.threadId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

      const conversationData =
        await conversationResponse.json();

      if (
        conversationResponse.status === 401
      ) {
        handleAuthError();
        return;
      }

      if (conversationResponse.ok) {
        setConversation(
          conversationData.emails || []
        );
      }

      showToast(
        "Reply sent successfully",
        "📤"
      );
    } catch (error) {
      console.error(
        "Reply error:",
        error
      );

      showToast(
        error.message ||
        "Failed to send reply",
        "!"
      );
    } finally {
      setReplyLoading(false);
    }
  };

  // --------------------------------------------------
  // SEND OTP
  // --------------------------------------------------
  //! OLD SEND OTP
  // const sendOTP = async () => {
  //   setError("");
  //   setLoading(true);

  //   try {
  //     const response = await fetch(
  //       `${API_URL}/api/auth/send-otp`,
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({
  //           phoneNumber,
  //         }),
  //       }
  //     );

  //     const data = await response.json();

  //     if (!response.ok) {
  //       throw new Error(
  //         data.message ||
  //         "Failed to send OTP"
  //       );
  //     }

  //     setScreen(4);
  //   } catch (error) {
  //     setError(error.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  //! NEW SEND OTP

  const sendOTP = () => {
    setError("");
    setLoading(true);

    if (
      typeof window.sendOtp !== "function"
    ) {
      setError(
        "OTP service is still loading. Please try again."
      );

      setLoading(false);
      return;
    }

    const identifier =
      `91${phoneNumber}`;

    console.log(
      "Sending MSG91 OTP to:",
      identifier
    );

    window.sendOtp(
      identifier,

      (data) => {
        console.log(
          "MSG91 OTP sent:",
          data
        );

        const reqId =
          data?.message ||
          data?.reqId ||
          data?.["reqId"] ||
          "";

        setMsg91ReqId(
          typeof reqId === "string"
            ? reqId
            : ""
        );

        setOtp("");

        setScreen(4);

        setLoading(false);
      },

      (error) => {
        console.error(
          "MSG91 Send OTP error:",
          error
        );

        setError(
          error?.message ||
          "Failed to send OTP"
        );

        setLoading(false);
      }
    );
  };


  // --------------------------------------------------
  // VERIFY OTP
  // --------------------------------------------------
  //! VERIFY OTP OLD
  // const verifyOTP = async () => {
  //   setError("");
  //   setLoading(true);

  //   try {
  //     const response = await fetch(
  //       `${API_URL}/api/auth/verify-otp`,
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({
  //           phoneNumber,
  //           otp,
  //         }),
  //       }
  //     );

  //     const data = await response.json();

  //     if (!response.ok) {
  //       throw new Error(
  //         data.message ||
  //         "Failed to verify OTP"
  //       );
  //     }

  //     localStorage.setItem(
  //       "token",
  //       data.token
  //     );

  //     localStorage.setItem(
  //       "user",
  //       JSON.stringify(data.user)
  //     );

  //     setScreen(5);

  //     setPhoneNumber("");
  //     setOtp("");
  //     setError("");
  //     setView("inbox");
  //   } catch (error) {
  //     setError(error.message);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  //! VERIFY OTP NEW

  const verifyOTP = () => {
    setError("");
    setLoading(true);

    if (
      typeof window.verifyOtp !== "function"
    ) {
      setError(
        "OTP service is not ready. Please try again."
      );

      setLoading(false);
      return;
    }

    window.verifyOtp(
      otp,

      async (data) => {
        try {
          console.log(
            "MSG91 OTP verified:",
            data
          );

          const accessToken =
            data?.["access-token"] ||
            data?.access_token ||
            data?.accessToken ||
            (
              typeof data?.message === "string"
                ? data.message
                : ""
            );

          if (!accessToken) {
            console.error(
              "MSG91 response did not contain access token:",
              data
            );

            throw new Error(
              "MSG91 did not return an access token"
            );
          }

          // ==================================
          // SEND MSG91 ACCESS TOKEN TO SERVER
          // ==================================

          const response =
            await fetch(
              `${API_URL}/api/auth/verify-msg91-token`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body: JSON.stringify({
                  phoneNumber,
                  accessToken
                })
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.message ||
              "Server verification failed"
            );
          }

          // ==================================
          // PHONEMAIL LOGIN SUCCESS
          // ==================================

          localStorage.setItem(
            "token",
            result.token
          );

          localStorage.setItem(
            "user",
            JSON.stringify(result.user)
          );

          console.log(
            "Logged in user:",
            result.user
          );

          setOtp("");

          setScreen(5);

        } catch (error) {
          console.error(
            "PhoneMail OTP verification error:",
            error
          );

          setError(
            error.message ||
            "Failed to verify OTP"
          );
        } finally {
          setLoading(false);
        }
      },

      (error) => {
        console.error(
          "MSG91 Verify OTP error:",
          error
        );

        setError(
          error?.message ||
          "Invalid OTP"
        );

        setLoading(false);
      },

      msg91ReqId || undefined
    );
  };

  // --------------------------------------------------
  // FETCH EMAILS
  // --------------------------------------------------

  const fetchEmails = async (
    targetView = view
  ) => {
    if (!token) {
      return;
    }

    try {
      let url = `${API_URL}/api/emails`;

      if (targetView === "sent") {
        url = `${API_URL}/api/emails/sent`;
      }

      if (targetView === "favorite") {
        url =
          `${API_URL}/api/emails` +
          `?favorites=true`;
      }

      if (targetView === "unread") {
        url =
          `${API_URL}/api/emails` +
          `?unread=true`;
      }

      if (targetView === "draft") {
        url = `${API_URL}/api/emails/drafts`;
      }

      if (targetView === "spam") {
        url = `${API_URL}/api/emails/spam`;
      }

      if (targetView === "trash") {
        url = `${API_URL}/api/emails/trash`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to fetch emails"
        );
      }

      setEmails(data.emails || []);
    } catch (error) {
      console.error(
        "Fetch emails error:",
        error
      );

      showToast(
        error.message ||
        "Failed to fetch emails",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // FETCH UNREAD COUNT
  // --------------------------------------------------

  const fetchUnreadCount = async () => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/emails`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to fetch unread count"
        );
      }

      const unreadEmails = (
        data.emails || []
      ).filter(
        (email) =>
          !email.isRead &&
          email.sender !== user.phoneNumber
      );

      setUnreadCount(
        unreadEmails.length
      );
    } catch (error) {
      console.error(
        "Fetch unread count error:",
        error
      );
    }
  };

  // --------------------------------------------------
  // FETCH DRAFTS
  // --------------------------------------------------

  const fetchDrafts = async () => {
    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/emails/drafts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to fetch drafts"
        );
      }

      setEmails(data.emails || []);
    } catch (error) {
      console.error(
        "Fetch drafts error:",
        error
      );

      showToast(
        error.message ||
        "Failed to fetch drafts",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // OPEN DRAFT
  // --------------------------------------------------

  const openDraft = (draft) => {
    setEditingDraft(draft);

    setRecipient(
      draft.recipients?.join(", ") || ""
    );

    setSubject(
      draft.subject || ""
    );

    setBody(
      draft.body || ""
    );

    setError("");
    setShowCompose(true);
  };

  // --------------------------------------------------
  // FETCH DATA WHEN VIEW CHANGES
  // --------------------------------------------------

  useEffect(() => {
    if (screen === 5 && token) {
      fetchEmails();
      fetchUnreadCount();
    }
  }, [screen, view]);


  // --------------------------------------------------
  // REAL-TIME EMAIL CONNECTION
  // --------------------------------------------------

  useEffect(() => {

    if (
      screen !== 5 ||
      !token
    ) {
      return;
    }

    const socket =
      io(API_URL, {
        auth: {
          token
        }
      });

    socket.on(
      "connect",
      () => {
        console.log(
          "Socket.IO connected:",
          socket.id
        );
      }
    );

    socket.on(
      "socket-connected",
      () => {
        console.log(
          "PhoneMail real-time connection established"
        );
      }
    );

    socket.on(
      "connect_error",
      (error) => {
        console.error(
          "Socket.IO connection error:",
          error.message
        );
      }
    );

    socket.on(
      "new-email",
      (email) => {

        console.log(
          "REAL-TIME EMAIL RECEIVED:",
          email
        );

        /*
          Prevent duplicate email if the
          event somehow arrives twice.
        */

        setEmails(
          (currentEmails) => {

            const alreadyExists =
              currentEmails.some(
                (item) =>
                  item._id === email._id
              );

            if (
              alreadyExists
            ) {
              return currentEmails;
            }

            /*
              Only add the incoming email
              to views where it belongs.
            */

            if (
              viewRef.current ===
              "inbox" ||
              viewRef.current ===
              "unread"
            ) {
              return [
                email,
                ...currentEmails
              ];
            }

            return currentEmails;
          }
        );

        /*
          If the user is currently
          viewing this conversation,
          immediately add the new
          message to the chat.
        */

        const currentEmail =
          selectedEmailRef.current;

        if (
          currentEmail &&
          currentEmail.threadId ===
          email.threadId
        ) {

          setConversation(
            (currentConversation) => {

              const alreadyExists =
                currentConversation.some(
                  (item) =>
                    item._id ===
                    email._id
                );

              if (
                alreadyExists
              ) {
                return currentConversation;
              }

              return [
                ...currentConversation,
                email
              ];
            }
          );
        }

        /*
          New inbox email is unread.
        */

        setUnreadCount(
          (currentCount) =>
            currentCount + 1
        );

        showToast(
          `New email from ${email.sender}`,
          "✉️"
        );
      }
    );

    return () => {

      socket.disconnect();

      console.log(
        "Socket.IO disconnected"
      );
    };

  }, [screen, token]);

  // --------------------------------------------------
  // SEARCH USER
  // --------------------------------------------------

  const searchUser = async () => {
    const cleanedPhone =
      searchPhone.replace(/\D/g, "");

    if (cleanedPhone.length !== 10) {
      showToast(
        "Enter a valid 10-digit phone number.",
        "!"
      );

      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/users/search?phoneNumber=${encodeURIComponent(
          cleanedPhone
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "User not found"
        );
      }

      setSearchedUser(data.user);
    } catch (error) {
      console.error(
        "Search user error:",
        error
      );

      setSearchedUser(null);

      showToast(
        error.message ||
        "User not found",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // SELECT RECIPIENT
  // --------------------------------------------------

  const selectRecipient = (
    searchedUser
  ) => {
    setRecipient(
      searchedUser.phoneNumber
    );

    setEditingDraft(null);
    setSubject("");
    setBody("");
    setError("");

    setShowCompose(true);

    setSearchedUser(null);
    setSearchPhone("");
  };

  // --------------------------------------------------
  // FAVORITE
  // --------------------------------------------------

  const toggleFavorite = async (
    emailId
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/favorite`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to update favorite"
        );
      }

      await fetchEmails();

      showToast(
        data.email?.isFavorite
          ? "Added to Favorites"
          : "Removed from Favorites",
        "⭐"
      );
    } catch (error) {
      console.error(
        "Favorite error:",
        error
      );

      showToast(
        error.message ||
        "Failed to update favorite",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // MOVE TO TRASH
  // --------------------------------------------------

  const moveToTrash = async (
    emailId
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/trash`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to move email to trash"
        );
      }

      clearConversation();

      await fetchEmails();
      await fetchUnreadCount();

      showToast(
        "Email moved to Trash",
        "🗑️"
      );
    } catch (error) {
      console.error(
        "Trash error:",
        error
      );

      showToast(
        error.message ||
        "Failed to move email to trash",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // MOVE TO SPAM
  // --------------------------------------------------

  const moveToSpam = async (
    emailId
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/spam`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to move email to spam"
        );
      }

      clearConversation();

      await fetchEmails();
      await fetchUnreadCount();

      showToast(
        "Email moved to Spam",
        "🚫"
      );
    } catch (error) {
      console.error(
        "Spam error:",
        error
      );

      showToast(
        error.message ||
        "Failed to move email to spam",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // RESTORE EMAIL
  // --------------------------------------------------

  const restoreEmail = async (
    emailId
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/restore`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to restore email"
        );
      }

      clearConversation();

      await fetchEmails();
      await fetchUnreadCount();

      showToast(
        "Email restored successfully",
        "♻️"
      );
    } catch (error) {
      console.error(
        "Restore error:",
        error
      );

      showToast(
        error.message ||
        "Failed to restore email",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // PERMANENT DELETE
  // --------------------------------------------------

  const deletePermanently = async (
    emailId
  ) => {
    const confirmed =
      window.confirm(
        "Delete this email permanently?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to delete email"
        );
      }

      clearConversation();

      await fetchEmails();
      await fetchUnreadCount();

      showToast(
        "Email permanently deleted",
        "❌"
      );
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      showToast(
        error.message ||
        "Failed to delete email",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // SAVE DRAFT
  // --------------------------------------------------

  const saveDraft = async () => {
    if (
      !recipient.trim() &&
      !subject.trim() &&
      !body.trim()
    ) {
      resetCompose();
      return;
    }

    /*
      IMPORTANT:
      The current backend does not have a
      PATCH /drafts/:id endpoint.

      Therefore, when editing an existing draft,
      we don't create another duplicate draft.
      The existing draft remains unchanged until
      the user sends it.
    */

    if (editingDraft) {
      resetCompose();

      showToast(
        "Draft closed. Changes were not saved.",
        "!"
      );

      return;
    }

    try {
      const recipients =
        parseRecipients(recipient);

      const response = await fetch(
        `${API_URL}/api/emails/drafts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipients,
            subject,
            body,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to save draft"
        );
      }

      resetCompose();

      if (view === "draft") {
        await fetchEmails("draft");
      }

      showToast(
        "Draft saved",
        "📝"
      );
    } catch (error) {
      console.error(
        "Save draft error:",
        error
      );

      showToast(
        error.message ||
        "Failed to save draft",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // SEND EMAIL
  // --------------------------------------------------

  const sendEmail = async () => {
    const recipients =
      parseRecipients(recipient);

    if (recipients.length === 0) {
      setError(
        "At least one recipient is required"
      );

      return;
    }

    if (!body.trim()) {
      setError(
        "Message is required"
      );

      return;
    }

    /*
      Prevent sending to yourself.
    */
    if (
      recipients.some(
        (number) =>
          number === user.phoneNumber
      )
    ) {
      setError(
        "You cannot send an email to yourself."
      );

      return;
    }

    setLoading(true);
    setError("");

    try {
      let response;

      // Existing draft
      if (editingDraft) {
        response = await fetch(
          `${API_URL}/api/emails/${editingDraft._id}/send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              recipients,
              subject,
              body,
            }),
          }
        );
      }

      // New email
      else {
        response = await fetch(
          `${API_URL}/api/emails`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              recipients,
              subject,
              body,
            }),
          }
        );
      }

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to send email"
        );
      }

      const wasEditingDraft =
        Boolean(editingDraft);

      resetCompose();

      setView("sent");

      await fetchEmails("sent");

      showToast(
        wasEditingDraft
          ? "Draft sent successfully"
          : "Email sent successfully",
        "📤"
      );
    } catch (error) {
      console.error(
        "Send email error:",
        error
      );

      setError(
        error.message ||
        "Failed to send email"
      );

      showToast(
        error.message ||
        "Failed to send email",
        "!"
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // UPDATE PROFILE
  // --------------------------------------------------

  const updateProfile = async (
    name
  ) => {
    if (!name?.trim()) {
      showToast(
        "Name cannot be empty.",
        "!"
      );

      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/users/me`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        handleAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to update profile"
        );
      }

      const updatedUser = {
        ...user,
        name: data.user.name,
      };

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      setShowProfile(false);

      showToast(
        "Profile updated successfully",
        "✓"
      );
    } catch (error) {
      console.error(
        "Profile update error:",
        error
      );

      showToast(
        error.message ||
        "Failed to update profile",
        "!"
      );
    }
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setScreen(1);

    setPhoneNumber("");
    setOtp("");

    setEmails([]);
    setConversation([]);
    setSelectedEmail(null);

    resetCompose();

    setUnreadCount(0);

    setView("inbox");

    setSearchPhone("");
    setSearchedUser(null);

    setReplyBody("");

    setShowProfile(false);
    setProfileName("");

    setAccepted(false);
    setError("");
  };

  // --------------------------------------------------
  // AUTH SCREEN 1
  // --------------------------------------------------

  if (screen === 1) {
    return (
      <div className="page">
        <main className="container">

          <h1>
            PhoneMail
          </h1>

          <h2>
            Choose your language
          </h2>

          <p className="description">
            Select your preferred language
            to continue.
          </p>

          <div className="languages">

            {languages.map((language) => (
              <button
                key={language.name}
                className={
                  `language ${selectedLanguage ===
                    language.name
                    ? "selected"
                    : ""
                  }`
                }
                onClick={() =>
                  setSelectedLanguage(
                    language.name
                  )
                }
              >
                <span>
                  {language.name}
                </span>

                <span className="native">
                  {language.native}
                </span>
              </button>
            ))}

          </div>

          <button
            className="continue-button"
            onClick={() =>
              setScreen(2)
            }
          >
            Continue
          </button>

          <p className="step">
            Step 1 of 4
          </p>

        </main>
      </div>
    );
  }

  // --------------------------------------------------
  // AUTH SCREEN 2
  // --------------------------------------------------

  if (screen === 2) {
    return (
      <div className="page">
        <main className="container">

          <h1>
            PhoneMail
          </h1>

          <h2>
            Terms & Conditions
          </h2>

          <p className="description">
            Please read and accept the Terms
            & Conditions before continuing.
          </p>

          <div className="terms">

            <p>
              By using PhoneMail, you agree
              to follow the terms and
              conditions of the service.
            </p>

            <p>
              Please use PhoneMail responsibly
              and provide accurate information
              when creating your account.
            </p>

            <p>
              You can review the complete
              Terms & Conditions before
              continuing.
            </p>

          </div>

          <label className="terms-check">

            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) =>
                setAccepted(
                  e.target.checked
                )
              }
            />

            <span>
              I agree to the Terms &
              Conditions
            </span>

          </label>

          <button
            className="continue-button"
            disabled={!accepted}
            onClick={() =>
              setScreen(3)
            }
          >
            Continue
          </button>

          <p className="step">
            Step 2 of 4
          </p>

        </main>
      </div>
    );
  }

  // --------------------------------------------------
  // AUTH SCREEN 3
  // --------------------------------------------------

  if (screen === 3) {
    return (
      <div className="page">
        <main className="container">

          <h1>
            PhoneMail
          </h1>

          <h2>
            Verify your phone number
          </h2>

          <p className="description">
            Enter your phone number to
            create your PhoneMail account.
          </p>

          <label
            className="input-label"
            htmlFor="phone"
          >
            Phone number
          </label>

          <div className="phone-input">

            <span className="country-code">
              +91
            </span>

            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
                );

                setError("");
              }}
              placeholder="Enter phone number"
              maxLength="10"
            />

          </div>

          <p className="input-hint">
            We'll send an OTP to this number.
          </p>

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            className="continue-button"
            disabled={
              phoneNumber.length !== 10 ||
              loading
            }
            onClick={sendOTP}
          >
            {loading
              ? "Sending..."
              : "Send OTP"}
          </button>

          <p className="step">
            Step 3 of 4
          </p>

        </main>
      </div>
    );
  }

  // --------------------------------------------------
  // AUTH SCREEN 4
  // --------------------------------------------------

  if (screen === 4) {
    return (
      <div className="page">
        <main className="container">

          <h1>
            PhoneMail
          </h1>

          <h2>
            Enter OTP
          </h2>

          <p className="description">
            Enter the 6-digit OTP sent to
            +91 {phoneNumber}.
          </p>

          <label
            className="input-label"
            htmlFor="otp"
          >
            OTP
          </label>

          <input
            id="otp"
            className="otp-input"
            type="tel"
            value={otp}
            onChange={(e) => {
              setOtp(
                e.target.value.replace(
                  /\D/g,
                  ""
                )
              );

              setError("");
            }}
            placeholder="Enter 6-digit OTP"
            maxLength="6"
          />

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            className="continue-button"
            id="otp-continue-button"
            disabled={
              otp.length !== 6 ||
              loading
            }
            onClick={verifyOTP}
          >
            {loading
              ? "Verifying..."
              : "Verify OTP"}
          </button>

          <p className="step">
            Step 4 of 4
          </p>

        </main>
      </div>
    );
  }

  // --------------------------------------------------
  // HOME SCREEN
  // --------------------------------------------------

  return (
    <div className="home-page">

      {/* TOAST */}

      {toasts.length > 0 && (
        <div className="toast-container">

          {toasts.map((toast) => (
            <div
              className="toast"
              key={toast.id}
            >

              <span className="toast-icon">
                {toast.icon}
              </span>

              <span className="toast-message">
                {toast.message}
              </span>

              <button
                className="toast-close"
                onClick={() => {
                  clearTimeout(
                    toastTimers.current[
                    toast.id
                    ]
                  );

                  setToasts(
                    (currentToasts) =>
                      currentToasts.filter(
                        (item) =>
                          item.id !==
                          toast.id
                      )
                  );

                  delete toastTimers.current[
                    toast.id
                  ];
                }}
              >
                ×
              </button>

            </div>
          ))}

        </div>
      )}

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="logo">
          PhoneMail
        </div>

        <button
          className="compose-button"
          onClick={() => {
            setEditingDraft(null);
            setRecipient("");
            setSubject("");
            setBody("");
            setError("");

            setShowCompose(true);
          }}
        >
          + Compose
        </button>

        <nav className="sidebar-nav">

          {/* INBOX */}

          <button
            className={
              view === "inbox"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setView("inbox");
              clearConversation();
            }}
          >

            <span className="nav-item-content">

              <span>
                📥 Inbox
              </span>

              {unreadCount > 0 && (
                <span className="unread-badge">
                  {unreadCount}
                </span>
              )}

            </span>

          </button>

          {/* SENT */}

          <button
            className={
              view === "sent"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setView("sent");
              clearConversation();
            }}
          >
            📤 Sent
          </button>

          {/* FAVORITES */}

          <button
            className={
              view === "favorite"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setView("favorite");
              clearConversation();
            }}
          >
            ⭐ Favorites
          </button>

          {/* DRAFTS */}

          <button
            className={
              view === "draft"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setView("draft");
              clearConversation();
            }}
          >
            📝 Drafts
          </button>

          {/* SPAM */}

          <button
            className={
              view === "spam"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setView("spam");
              clearConversation();
            }}
          >
            🚫 Spam
          </button>

          {/* TRASH */}

          <button
            className={
              view === "trash"
                ? "nav-item active"
                : "nav-item"
            }
            onClick={() => {
              setView("trash");
              clearConversation();
            }}
          >
            🗑 Trash
          </button>

        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <button
            className="profile-mini"
            onClick={() => {
              setProfileName(
                user.name || ""
              );

              setShowProfile(true);
            }}
          >

            <div className="avatar">
              {user.phoneNumber?.slice(-2) ||
                "PM"}
            </div>

            <div>

              <strong>
                {user.name ||
                  user.phoneNumber}
              </strong>

              <span>
                {user.emailId}
              </span>

            </div>

          </button>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="home-main">

        <header className="home-header">

          <div>

            <h2>

              {view === "inbox" &&
                "Inbox"}

              {view === "sent" &&
                "Sent"}

              {view === "favorite" &&
                "Favorites"}

              {view === "draft" &&
                "Drafts"}

              {view === "spam" &&
                "Spam"}

              {view === "trash" &&
                "Trash"}

              {view === "unread" &&
                "Unread"}

            </h2>

            <p>
              {user.emailId}
            </p>

          </div>

          {/* SEARCH */}

          <div className="search-container">

            <input
              type="tel"
              placeholder="Search phone number..."
              value={searchPhone}
              onChange={(e) => {
                setSearchPhone(
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
                );

                setSearchedUser(null);
              }}
              maxLength="10"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  searchUser();
                }
              }}
            />

            <button
              onClick={searchUser}
            >
              Search
            </button>

          </div>

        </header>

        {/* FILTER BAR */}

        <div className="filter-bar">

          <button
            onClick={() => {
              setView("inbox");
              clearConversation();
            }}
            className={
              view === "inbox"
                ? "filter active"
                : "filter"
            }
          >
            All
          </button>

          <button
            onClick={() => {
              setView("unread");
              clearConversation();
            }}
            className={
              view === "unread"
                ? "filter active"
                : "filter"
            }
          >
            ✉️ Unread
          </button>

        </div>

        {/* SEARCH RESULT */}

        {searchedUser && (
          <div className="user-result">

            <div className="avatar large">
              {searchedUser.phoneNumber.slice(
                -2
              )}
            </div>

            <div>

              <strong>
                {searchedUser.name ||
                  "PhoneMail User"}
              </strong>

              <p>
                +91 {searchedUser.phoneNumber}
              </p>

              <small>
                {searchedUser.emailId}
              </small>

            </div>

            <button
              onClick={() =>
                selectRecipient(
                  searchedUser
                )
              }
            >
              Compose
            </button>

          </div>
        )}

        {/* ERROR */}

        {error && (
          <p className="home-error">
            {error}
          </p>
        )}

        {/* EMAIL LIST */}

        {!selectedEmail && (
          <section className="email-list">

            {emails.length === 0 ? (

              <div className="empty-state">

                <div className="empty-icon">
                  ✉
                </div>

                <h3>
                  No emails yet
                </h3>

                <p>
                  Your conversations will
                  appear here.
                </p>

                <button
                  onClick={() => {
                    setEditingDraft(null);
                    setRecipient("");
                    setSubject("");
                    setBody("");
                    setShowCompose(true);
                  }}
                >
                  Compose your first email
                </button>

              </div>

            ) : (

              emails.map((email) => (

                <button
                  className={
                    `email-card ${!email.isRead
                      ? "unread"
                      : ""
                    }`
                  }
                  key={email._id}
                  onClick={() => {
                    if (view === "draft") {
                      openDraft(email);
                    } else {
                      openConversation(email);
                    }
                  }}
                >

                  <div className="email-avatar">
                    {(
                      email.sender ||
                      "PM"
                    ).slice(-2)}
                  </div>

                  <div className="email-content">

                    <div className="email-top">

                      <strong>

                        {email.sender ===
                          user.phoneNumber
                          ? `To: ${email.recipients?.join(
                            ", "
                          ) || ""
                          }`
                          : email.sender}

                      </strong>

                      <span>
                        {new Date(
                          email.createdAt
                        ).toLocaleDateString()}
                      </span>

                    </div>

                    <h3
                      className={
                        !email.isRead
                          ? "unread-subject"
                          : ""
                      }
                    >
                      {email.subject ||
                        "(No subject)"}
                    </h3>

                    <p>
                      {email.body?.slice(
                        0,
                        100
                      )}
                    </p>

                  </div>

                  {/* FAVORITE */}

                  <span
                    className="favorite-star"
                    onClick={(e) => {
                      e.stopPropagation();

                      toggleFavorite(
                        email._id
                      );
                    }}
                  >
                    {email.isFavorite
                      ? "★"
                      : "☆"}
                  </span>

                </button>

              ))

            )}

          </section>
        )}

        {/* EMAIL VIEW */}

        {selectedEmail && (

          <section className="email-view">

            <button
              className="back-button"
              onClick={() => {
                clearConversation();
              }}
            >
              ← Back
            </button>

            {/* EMAIL ACTIONS */}

            <div className="email-actions">

              {view !== "trash" &&
                view !== "spam" && (
                  <>
                    <button
                      onClick={() =>
                        moveToTrash(
                          selectedEmail._id
                        )
                      }
                    >
                      🗑 Trash
                    </button>

                    <button
                      onClick={() =>
                        moveToSpam(
                          selectedEmail._id
                        )
                      }
                    >
                      🚫 Spam
                    </button>
                  </>
                )}

              {(view === "trash" ||
                view === "spam") && (

                  <button
                    onClick={() =>
                      restoreEmail(
                        selectedEmail._id
                      )
                    }
                  >
                    ♻️ Restore
                  </button>

                )}

              {view === "trash" && (

                <button
                  onClick={() =>
                    deletePermanently(
                      selectedEmail._id
                    )
                  }
                >
                  ❌ Delete Permanently
                </button>

              )}

            </div>

            {/* SUBJECT */}

            <h1>
              {selectedEmail.subject ||
                "(No subject)"}
            </h1>

            {/* CONVERSATION */}

            <div className="conversation-messages">

              {conversation.map((email) => (

                <div
                  key={email._id}
                  className={
                    email.sender ===
                      user.phoneNumber
                      ? "message sent"
                      : "message received"
                  }
                >

                  <div className="message-header">

                    <strong>
                      {email.sender ===
                        user.phoneNumber
                        ? "You"
                        : email.sender}
                    </strong>

                  </div>

                  <p>
                    {email.body}
                  </p>

                  <small>
                    {new Date(
                      email.createdAt
                    ).toLocaleString()}
                  </small>

                </div>

              ))}

            </div>

            {/* REPLY */}

            {conversation.some(
              (message) =>
                !message.hasReplied &&
                message.sender !==
                user.phoneNumber
            ) && (

                <div className="reply-box">

                  <textarea
                    placeholder="Write a reply..."
                    value={replyBody}
                    onChange={(e) =>
                      setReplyBody(
                        e.target.value
                      )
                    }
                  />

                  <button
                    onClick={sendReply}
                    disabled={
                      replyLoading ||
                      !replyBody.trim()
                    }
                  >
                    {replyLoading
                      ? "Sending..."
                      : "Send"}
                  </button>

                </div>

              )}

          </section>

        )}

      </main>

      {/* COMPOSE MODAL */}

      {showCompose && (

        <div className="modal-overlay">

          <div className="compose-modal">

            <div className="compose-header">

              <h2>
                {editingDraft
                  ? "Edit Draft"
                  : "New Message"}
              </h2>

              <button
                onClick={saveDraft}
              >
                ✕
              </button>

            </div>

            <label>
              To
            </label>

            <input
              type="text"
              placeholder="Phone number(s), separated by commas"
              value={recipient}
              onChange={(e) =>
                setRecipient(
                  e.target.value.replace(
                    /[^\d,\s]/g,
                    ""
                  )
                )
              }
            />

            <small>
              Multiple recipients:
              {" "}
              9876543210, 9123456789
            </small>

            <label>
              Subject
            </label>

            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) =>
                setSubject(
                  e.target.value
                )
              }
            />

            <label>
              Message
            </label>

            <textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) =>
                setBody(
                  e.target.value
                )
              }
            />

            <button
              className="send-button"
              onClick={sendEmail}
              disabled={
                loading ||
                !recipient.trim() ||
                !body.trim()
              }
            >
              {loading
                ? "Sending..."
                : "Send Email"}
            </button>

          </div>

        </div>

      )}

      {/* PROFILE MODAL */}

      {showProfile && (

        <div
          className="modal-overlay"
          onClick={() =>
            setShowProfile(false)
          }
        >

          <div
            className="compose-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="compose-header">

              <h2>
                Profile
              </h2>

              <button
                onClick={() =>
                  setShowProfile(false)
                }
              >
                ✕
              </button>

            </div>

            <div className="profile-details">

              <div className="avatar large">
                {user.phoneNumber?.slice(-2) ||
                  "PM"}
              </div>

              <strong>
                {user.emailId}
              </strong>

              <span>
                +91 {user.phoneNumber}
              </span>

            </div>

            <label>
              Name
            </label>

            <input
              type="text"
              placeholder="Enter your name"
              value={profileName}
              onChange={(e) =>
                setProfileName(
                  e.target.value
                )
              }
            />

            <button
              className="send-button"
              onClick={() =>
                updateProfile(
                  profileName
                )
              }
            >
              Save Profile
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;