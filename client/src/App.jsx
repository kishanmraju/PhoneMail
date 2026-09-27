import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const [screen, setScreen] = useState(() => {
    const savedToken = localStorage.getItem("token");

    return savedToken ? 5 : 1;
  });

  const [accepted, setAccepted] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");

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

  // --------------------------------------------------
  // TOAST
  // --------------------------------------------------

  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});

  const showToast = (message, icon = "✓") => {
    const id = Date.now() + Math.random();

    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id,
        message,
        icon
      }
    ]);

    toastTimers.current[id] = setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((toast) => toast.id !== id)
      );

      delete toastTimers.current[id];
    }, 3000);
  };

  const languages = [
    { name: "English", native: "English" },
    { name: "Tamil", native: "தமிழ்" },
    { name: "Hindi", native: "हिन्दी" },
    { name: "Telugu", native: "తెలుగు" },
    { name: "Kannada", native: "ಕನ್ನಡ" },
  ];

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");


  // --------------------------------------------------
  // OPEN CONVERSATION
  // --------------------------------------------------

  const openConversation = async (email) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/thread/${email.threadId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch conversation"
        );
      }

      setConversation(data.emails);
      setSelectedEmail(email);

      // Mark received email as read
      if (
        !email.isRead &&
        email.sender !== user.phoneNumber
      ) {
        const readResponse = await fetch(
          `${API_URL}/api/emails/${email._id}/read`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (readResponse.ok) {
          setEmails((currentEmails) => {
            if (view === "unread") {
              return currentEmails.filter(
                (item) => item._id !== email._id
              );
            }

            return currentEmails.map((item) =>
              item._id === email._id
                ? { ...item, isRead: true }
                : item
            );
          });

          setUnreadCount((currentCount) =>
            Math.max(0, currentCount - 1)
          );
        }
      }

    } catch (error) {
      console.error("Conversation error:", error);
    }
  };


  // --------------------------------------------------
  // SEND REPLY
  // --------------------------------------------------

  const sendReply = async () => {
    if (!replyBody.trim()) {
      return;
    }

    try {
      setReplyLoading(true);

      const response = await fetch(
        `${API_URL}/api/emails/${selectedEmail._id}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            body: replyBody
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to send reply"
        );
      }

      await openConversation(selectedEmail);

      setReplyBody("");

      showToast("Reply sent successfully", "📤");

    } catch (error) {
      console.error("Reply error:", error);
      alert(error.message);
    } finally {
      setReplyLoading(false);
    }
  };


  // --------------------------------------------------
  // SEND OTP
  // --------------------------------------------------

  const sendOTP = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/send-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to send OTP"
        );
      }

      setScreen(4);

    } catch (error) {
      setError(error.message);

    } finally {
      setLoading(false);
    }
  };


  // --------------------------------------------------
  // VERIFY OTP
  // --------------------------------------------------

  const verifyOTP = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber,
            otp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to verify OTP"
        );
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      console.log("Logged in user:", data.user);

      setScreen(5);

    } catch (error) {
      setError(error.message);

    } finally {
      setLoading(false);
    }
  };


  // --------------------------------------------------
  // FETCH EMAILS
  // --------------------------------------------------

  const fetchEmails = async () => {
    try {
      let url = `${API_URL}/api/emails`;

      if (view === "sent") {
        url = `${API_URL}/api/emails/sent`;
      }

      if (view === "favorite") {
        url = `${API_URL}/api/emails?favorites=true`;
      }

      if (view === "unread") {
        url = `${API_URL}/api/emails?unread=true`;
      }

      if (view === "draft") {
        url = `${API_URL}/api/emails/drafts`;
      }

      if (view === "spam") {
        url = `${API_URL}/api/emails/spam`;
      }

      if (view === "trash") {
        url = `${API_URL}/api/emails/trash`;
      }

      const response = await fetch(
        url,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch emails"
        );
      }

      setEmails(data.emails || []);

    } catch (error) {
      console.error(
        "Fetch emails error:",
        error
      );
    }
  };


  // --------------------------------------------------
  // FETCH UNREAD COUNT
  // --------------------------------------------------

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch unread count"
        );
      }

      const unreadEmails = (data.emails || []).filter(
        (email) => !email.isRead
      );

      setUnreadCount(unreadEmails.length);

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
    try {
      const response = await fetch(
        `${API_URL}/api/emails/drafts`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      console.log(
        "DRAFT RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to fetch drafts"
        );
      }

      setEmails(data.emails || []);

    } catch (error) {
      console.error(
        "Fetch drafts error:",
        error
      );

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // OPEN DRAFT
  // --------------------------------------------------

  const openDraft = (draft) => {
    setEditingDraft(draft);

    setRecipient(
      draft.recipients?.length > 0
        ? draft.recipients[0]
        : ""
    );

    setSubject(
      draft.subject || ""
    );

    setBody(
      draft.body || ""
    );

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
  // SEARCH USER
  // --------------------------------------------------

  const searchUser = async () => {
    if (!searchPhone.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/users/search?phoneNumber=${searchPhone}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "User not found"
        );
      }

      setSearchedUser(data.user);

    } catch (error) {
      console.error(
        "Search user error:",
        error
      );

      setSearchedUser(null);

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // SELECT RECIPIENT
  // --------------------------------------------------

  const selectRecipient = (user) => {
    setRecipient(
      user.phoneNumber
    );

    setShowCompose(true);

    setSearchedUser(null);

    setSearchPhone("");
  };


  // --------------------------------------------------
  // FAVORITE
  // --------------------------------------------------

  const toggleFavorite = async (emailId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/favorite`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to update favorite"
        );
      }

      await fetchEmails();

    } catch (error) {
      console.error(
        "Favorite error:",
        error
      );

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // MOVE TO TRASH
  // --------------------------------------------------

  const moveToTrash = async (emailId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/trash`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to move email to trash"
        );
      }

      setSelectedEmail(null);
      setConversation([]);

      await fetchEmails();

      showToast(
        "Email moved to Trash",
        "🗑️"
      );

    } catch (error) {
      console.error(
        "Trash error:",
        error
      );

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // MOVE TO SPAM
  // --------------------------------------------------

  const moveToSpam = async (emailId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/spam`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to move email to spam"
        );
      }

      setSelectedEmail(null);
      setConversation([]);

      await fetchEmails();

      showToast(
        "Email moved to Spam",
        "🚫"
      );

    } catch (error) {
      console.error(
        "Spam error:",
        error
      );

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // RESTORE EMAIL
  // --------------------------------------------------

  const restoreEmail = async (emailId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}/restore`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to restore email"
        );
      }

      setSelectedEmail(null);
      setConversation([]);

      await fetchEmails();

      showToast(
        "Email restored successfully",
        "♻️"
      );

    } catch (error) {
      console.error(
        "Restore error:",
        error
      );

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // PERMANENT DELETE
  // --------------------------------------------------

  const deletePermanently = async (emailId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/emails/${emailId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to delete email"
        );
      }

      setSelectedEmail(null);
      setConversation([]);

      await fetchEmails();

      showToast(
        "Email permanently deleted",
        "❌"
      );

    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // SAVE DRAFT
  // --------------------------------------------------

  const saveDraft = async () => {
    if (
      !recipient &&
      !subject &&
      !body
    ) {
      setShowCompose(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/emails/drafts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            recipients: recipient
              ? [recipient]
              : [],
            subject,
            body
          })
        }
      );

      const data = await response.json();

      console.log(
        "SAVE DRAFT RESPONSE:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data.message ||
          "Failed to save draft"
        );
      }

      setShowCompose(false);

    } catch (error) {
      console.error(
        "Save draft error:",
        error
      );

      alert(error.message);
    }
  };


  // --------------------------------------------------
  // SEND EMAIL
  // --------------------------------------------------

  const sendEmail = async () => {
    if (
      !recipient ||
      !body.trim()
    ) {
      setError(
        "Recipient and message are required"
      );

      return;
    }

    setLoading(true);
    setError("");

    try {

      // --------------------------------
      // EDITING AN EXISTING DRAFT
      // --------------------------------

      if (editingDraft) {
        const response = await fetch(
          `${API_URL}/api/emails/${editingDraft._id}/send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              recipients: [recipient],
              subject,
              body
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
            "Failed to send draft"
          );
        }
      }

      // --------------------------------
      // NORMAL NEW EMAIL
      // --------------------------------

      else {
        const response = await fetch(
          `${API_URL}/api/emails`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              recipients: [recipient],
              subject,
              body
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
            "Failed to send email"
          );
        }
      }

      // --------------------------------
      // RESET COMPOSE
      // --------------------------------

      const wasEditingDraft =
        Boolean(editingDraft);

      setRecipient("");
      setSubject("");
      setBody("");
      setEditingDraft(null);
      setShowCompose(false);

      setView("sent");

      await fetchEmails();

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

    } finally {
      setLoading(false);
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
                  `language ${selectedLanguage === language.name
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
                          item.id !== toast.id
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
            setShowCompose(true);
            setError("");

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
              setSelectedEmail(null);
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
              setSelectedEmail(null);
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
              setSelectedEmail(null);
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
              setSelectedEmail(null);
              fetchDrafts();

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
              setSelectedEmail(null);
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
              setSelectedEmail(null);
            }}
          >
            🗑 Trash
          </button>

        </nav>


        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <div className="profile-mini">

            <div className="avatar">
              {user.phoneNumber?.slice(-2) ||
                "PM"}
            </div>

            <div>

              <strong>
                {user.phoneNumber}
              </strong>

              <span>
                {user.emailId}
              </span>

            </div>

          </div>

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
            onClick={() =>
              setView("inbox")
            }
            className={
              view === "inbox"
                ? "filter active"
                : "filter"
            }
          >
            All
          </button>


          {/* IMPORTANT:
              This is a FILTER, not a sidebar nav item.
          */}

          <button
            onClick={() => {
              setView("unread");
              setSelectedEmail(null);
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
              {searchedUser.phoneNumber.slice(-2)}
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
                  onClick={() =>
                    setShowCompose(true)
                  }
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
                    {email.sender?.slice(-2)}
                  </div>

                  <div className="email-content">

                    <div className="email-top">

                      <strong>

                        {email.sender ===
                          user.phoneNumber
                          ? `To: ${email.recipients?.join(
                            ", "
                          )}`
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
                setSelectedEmail(null);
                setConversation([]);
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


            <p>
              Email ID:{" "}
              {selectedEmail._id}
            </p>


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
              type="tel"
              placeholder="Phone number"
              value={recipient}
              onChange={(e) =>
                setRecipient(
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
            />


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
              disabled={loading}
            >
              {loading
                ? "Sending..."
                : "Send Email"}
            </button>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;