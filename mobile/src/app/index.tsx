import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { io } from "socket.io-client";

const PURPLE = "#5741B0";
const BORDER = "#8D78E2";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID;
const MSG91_WIDGET_TOKEN = process.env.EXPO_PUBLIC_MSG91_WIDGET_TOKEN;

type Screen = "phone" | "otp" | "home" | "conversation";

type Folder = "inbox" | "drafts" | "trash" | "spam";

export default function HomeScreen() {
  // =====================================================
  // SCREEN
  // =====================================================

  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window === "undefined") {
      return "phone";
    }

    const token = localStorage.getItem("token");

    return token ? "home" : "phone";
  });

  // =====================================================
  // AUTH
  // =====================================================

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [msg91ReqId, setMsg91ReqId] = useState("");

  // =====================================================
  // USER
  // =====================================================

  const [currentUserPhone, setCurrentUserPhone] = useState("");

  // =====================================================
  // EMAILS
  // =====================================================

  const [emails, setEmails] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [folder, setFolder] = useState<Folder>("inbox");

  // =====================================================
  // TOAST
  // =====================================================

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    visible: false,
    message: "",
    type: "info",
  });

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setToast({
      visible: true,
      message,
      type,
    });

    setTimeout(() => {
      setToast((current) => ({
        ...current,
        visible: false,
      }));
    }, 2500);
  };

  // =====================================================
  // CONVERSATION
  // =====================================================

  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  // Keep the currently open conversation available to the persistent socket
  // without recreating the socket every time the screen changes.
  const selectedEmailRef = useRef<any>(null);

  useEffect(() => {
    selectedEmailRef.current = selectedEmail;
  }, [selectedEmail]);

  const [conversation, setConversation] = useState<any[]>([]);

  const [loadingConversation, setLoadingConversation] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  // =====================================================
  // COMPOSE
  // =====================================================

  const [showCompose, setShowCompose] = useState(false);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [sendLoading, setSendLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  const [editingDraft, setEditingDraft] = useState<any>(null);

  // =====================================================
  // LOAD SAVED USER
  // =====================================================

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser);

        setCurrentUserPhone(user.phoneNumber || "");
        setPhone(user.phoneNumber || "");
        setScreen("home");
      } catch (error) {
        console.error("Failed to load saved user:", error);
      }
    }
  }, []);

  // =====================================================
  // MSG91
  // =====================================================

  useEffect(() => {
    if (!MSG91_WIDGET_ID || !MSG91_WIDGET_TOKEN) {
      console.error("MSG91 environment variables missing");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const initializeMSG91 = () => {
      if (
        typeof window === "undefined" ||
        typeof (window as any).initSendOTP !== "function"
      ) {
        console.error("MSG91 OTP widget not available");
        return;
      }

      if ((window as any).__phoneMailMSG91Initialized) {
        return;
      }

      (window as any).initSendOTP({
        widgetId: MSG91_WIDGET_ID,
        tokenAuth: MSG91_WIDGET_TOKEN,
        exposeMethods: true,

        success: (data: any) => {
          console.log("MSG91 success:", data);
        },

        failure: (error: any) => {
          console.error("MSG91 failure:", error);
        },
      });

      (window as any).__phoneMailMSG91Initialized = true;

      console.log("MSG91 initialized");
    };

    const existingScript = document.querySelector(
      'script[src="https://verify.msg91.com/otp-provider.js"]',
    );

    if (existingScript) {
      initializeMSG91();
      return;
    }

    const script = document.createElement("script");

    script.src = "https://verify.msg91.com/otp-provider.js";
    script.async = true;
    script.onload = initializeMSG91;

    script.onerror = () => {
      console.error("Failed to load MSG91");
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  // =====================================================
  // FETCH INBOX
  // =====================================================

  const fetchEmails = async () => {
    try {
      setLoadingEmails(true);

      const token = localStorage.getItem("token");

      if (!token) {
        console.log("No JWT token found");
        return;
      }

      const response = await fetch(`${API_URL}/api/emails`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch emails");
      }

      const emailList = Array.isArray(data) ? data : data.emails || [];

      setEmails(emailList);
    } catch (error) {
      console.error("Fetch emails error:", error);
    } finally {
      setLoadingEmails(false);
    }
  };

  // =====================================================
  // FETCH SENT
  // =====================================================

  const fetchSentEmails = async () => {
    try {
      setLoadingEmails(true);

      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/api/emails/sent`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch sent emails");
      }

      const emailList = Array.isArray(data) ? data : data.emails || [];

      setEmails(emailList);
    } catch (error) {
      console.error("Fetch sent emails error:", error);
      showToast("Could not load sent emails", "error");
    } finally {
      setLoadingEmails(false);
    }
  };

  // =====================================================
  // FETCH DRAFTS
  // =====================================================

  const fetchDrafts = async () => {
    try {
      setLoadingEmails(true);

      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/api/emails/drafts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch drafts");
      }

      const draftList = Array.isArray(data) ? data : data.emails || [];

      setEmails(draftList);
    } catch (error) {
      console.error("Fetch drafts error:", error);
      showToast("Could not load drafts", "error");
    } finally {
      setLoadingEmails(false);
    }
  };

  // =====================================================
  // FETCH TRASH
  // =====================================================

  const fetchTrash = async () => {
    try {
      setLoadingEmails(true);

      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/api/emails/trash`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch trash");
      }

      const trashList = Array.isArray(data) ? data : data.emails || [];

      setEmails(trashList);
    } catch (error) {
      console.error("Fetch trash error:", error);
      showToast("Could not load trash", "error");
    } finally {
      setLoadingEmails(false);
    }
  };

  // =====================================================
  // FETCH SPAM
  // =====================================================

  const fetchSpam = async () => {
    try {
      setLoadingEmails(true);

      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/api/emails/spam`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch spam");
      }

      const spamList = Array.isArray(data) ? data : data.emails || [];

      setEmails(spamList);
    } catch (error) {
      console.error("Fetch spam error:", error);
      showToast("Could not load spam", "error");
    } finally {
      setLoadingEmails(false);
    }
  };

  // =====================================================
  // FETCH CURRENT FOLDER
  // =====================================================

  const fetchCurrentFolder = async (selectedFolder: Folder = folder) => {
    if (selectedFolder === "inbox") {
      await fetchEmails();
      return;
    }

    if (selectedFolder === "drafts") {
      await fetchDrafts();
      return;
    }

    if (selectedFolder === "trash") {
      await fetchTrash();
      return;
    }

    if (selectedFolder === "spam") {
      await fetchSpam();
    }
  };

  // =====================================================
  // FETCH AFTER LOGIN / REFRESH
  // =====================================================

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      fetchEmails();
    }
  }, []);

  // =====================================================
  // SOCKET.IO REAL-TIME EMAILS
  // =====================================================

  const socketRef = useRef<any>(null);
  const folderRef = useRef<Folder>(folder);

  useEffect(() => {
    folderRef.current = folder;
  }, [folder]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || screen === "phone" || screen === "otp") {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!API_URL) {
      console.error("API URL is missing");
      return;
    }

    // Keep exactly ONE socket connection for the whole logged-in session.
    if (socketRef.current) {
      return;
    }

    console.log("Connecting PhoneMail socket...");

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("PhoneMail socket connected:", socket.id);
    });

    socket.on("socket-connected", (data: any) => {
      console.log("Socket:", data);
    });

    socket.on("new-email", (email: any) => {
      console.log("NEW EMAIL RECEIVED:", email);

      // Always keep the inbox list synchronized.
      setEmails((currentEmails) => {
        const alreadyExists = currentEmails.some(
          (item) => item._id === email._id,
        );

        return alreadyExists ? currentEmails : [email, ...currentEmails];
      });

      // IMPORTANT:
      // Do not rely on selectedEmailRef/threadId here.
      // The conversation can be open while selectedEmail is stale,
      // especially immediately after opening a chat.
      //
      // Instead, identify the currently open conversation by the
      // conversation state itself. If it contains the same thread,
      // append the incoming message directly.
      setConversation((currentConversation) => {
        if (currentConversation.length === 0) {
          return currentConversation;
        }

        const currentThreadId =
          currentConversation[0]?.threadId ||
          selectedEmailRef.current?.threadId;

        if (!currentThreadId || email?.threadId !== currentThreadId) {
          return currentConversation;
        }

        const alreadyExists = currentConversation.some(
          (item) => item._id === email._id,
        );

        if (alreadyExists) {
          return currentConversation;
        }

        return [...currentConversation, email];
      });

      if (folderRef.current === "inbox") {
        showToast("New email received", "info");
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("PhoneMail socket disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });
  }, [screen]);

  // Keep the socket alive while navigating inside the app.
  // It is cleaned up only when the component is actually unmounted.
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // =====================================================
  // SEND OTP
  // =====================================================

  const sendOTP = () => {
    setError("");
    setLoading(true);

    if (
      typeof window === "undefined" ||
      typeof (window as any).sendOtp !== "function"
    ) {
      setError("OTP service is still loading. Please try again.");

      setLoading(false);
      return;
    }

    const identifier = `91${phone}`;

    console.log("Sending OTP to:", identifier);

    (window as any).sendOtp(
      identifier,

      (data: any) => {
        console.log("MSG91 OTP sent:", data);

        const reqId = data?.message || data?.reqId || data?.["reqId"] || "";

        setMsg91ReqId(typeof reqId === "string" ? reqId : "");

        setOtp("");
        setScreen("otp");
        setLoading(false);
      },

      (error: any) => {
        console.error("MSG91 Send OTP error:", error);

        setError(error?.message || "Failed to send OTP");

        setLoading(false);
      },
    );
  };

  // =====================================================
  // VERIFY OTP
  // =====================================================

  const verifyOTP = () => {
    setError("");
    setLoading(true);

    if (
      typeof window === "undefined" ||
      typeof (window as any).verifyOtp !== "function"
    ) {
      setError("OTP service is not ready.");

      setLoading(false);
      return;
    }

    (window as any).verifyOtp(
      otp,

      async (data: any) => {
        try {
          console.log("MSG91 verified:", data);

          const accessToken =
            data?.["access-token"] ||
            data?.access_token ||
            data?.accessToken ||
            (typeof data?.message === "string" ? data.message : "");

          if (!accessToken) {
            throw new Error("MSG91 did not return an access token");
          }

          const response = await fetch(
            `${API_URL}/api/auth/verify-msg91-token`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                phoneNumber: phone,
                accessToken,
              }),
            },
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.message || "Backend verification failed");
          }

          localStorage.setItem("token", result.token);
          localStorage.setItem("user", JSON.stringify(result.user));

          setCurrentUserPhone(result.user.phoneNumber);
          setPhone(result.user.phoneNumber);
          setOtp("");

          setFolder("inbox");
          setScreen("home");

          await fetchEmails();

          showToast("Signed in successfully", "success");
        } catch (err: any) {
          console.error(err);

          setError(err?.message || "Verification failed");
        } finally {
          setLoading(false);
        }
      },

      (error: any) => {
        console.error("MSG91 verification error:", error);

        setError(error?.message || "Invalid OTP");

        setLoading(false);
      },

      msg91ReqId || undefined,
    );
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {
    console.log("Logging out...");

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setCurrentUserPhone("");
    setPhone("");
    setOtp("");
    setEmails([]);
    setConversation([]);
    setSelectedEmail(null);
    setSearch("");
    setFilter("All");
    setFolder("inbox");
    setReplyText("");
    setError("");

    setShowCompose(false);
    setTo("");
    setSubject("");
    setBody("");
    setEditingDraft(null);

    setScreen("phone");
  };

  // =====================================================
  // MARK EMAIL AS READ
  // =====================================================

  const markEmailAsRead = async (email: any) => {
    if (!email?._id || email.isRead === true) {
      return;
    }

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/api/emails/${email._id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to mark email as read");
      }

      setEmails((currentEmails) =>
        currentEmails.map((item) =>
          item._id === email._id
            ? {
                ...item,
                isRead: true,
              }
            : item,
        ),
      );

      setSelectedEmail((current) =>
        current && current._id === email._id
          ? {
              ...current,
              isRead: true,
            }
          : current,
      );
    } catch (error) {
      console.error("Mark read error:", error);
    }
  };

  // =====================================================
  // TOGGLE FAVORITE
  // =====================================================

  const toggleFavorite = async (email: any) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_URL}/api/emails/${email._id}/favorite`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to update favorite");
      }

      const newFavorite =
        typeof data.isFavorite === "boolean"
          ? data.isFavorite
          : typeof data.email?.isFavorite === "boolean"
            ? data.email.isFavorite
            : !email.isFavorite;

      setEmails((currentEmails) =>
        currentEmails.map((item) =>
          item._id === email._id
            ? {
                ...item,
                isFavorite: newFavorite,
              }
            : item,
        ),
      );

      setSelectedEmail((current) =>
        current && current._id === email._id
          ? {
              ...current,
              isFavorite: newFavorite,
            }
          : current,
      );
    } catch (error: any) {
      console.error("Favorite error:", error);

      showToast(error.message || "Could not update favorite", "error");
    }
  };

  // =====================================================
  // OPEN CONVERSATION
  // =====================================================

  const openConversation = async (email: any) => {
    try {
      if (folder === "drafts") {
        openDraft(email);
        return;
      }

      if (folder === "trash" || folder === "spam") {
        setSelectedEmail(email);

        setScreen("conversation");

        setLoadingConversation(true);

        const token = localStorage.getItem("token");

        const response = await fetch(
          `${API_URL}/api/emails/thread/${email.threadId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load conversation");
        }

        const messages = Array.isArray(data)
          ? data
          : data.emails || data.messages || [];

        setConversation(messages);

        return;
      }

      await markEmailAsRead(email);

      const openedEmail = {
        ...email,
        isRead: true,
      };

      // Set the selected conversation immediately.
      // This lets the persistent Socket.IO listener know which thread
      // is currently open even while the REST request is loading.
      setSelectedEmail(openedEmail);
      selectedEmailRef.current = openedEmail;

      // Clear the previous conversation before loading this thread.
      setConversation([]);

      setScreen("conversation");

      setLoadingConversation(true);

      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/emails/thread/${email.threadId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load conversation");
      }

      const messages = Array.isArray(data)
        ? data
        : data.emails || data.messages || [];

      // Merge the REST result with any socket message that arrived while
      // this conversation was loading. This prevents a race condition
      // where the REST response overwrites a real-time message.
      setConversation((currentConversation) => {
        const merged = [...messages];

        for (const liveMessage of currentConversation) {
          if (!merged.some((item) => item._id === liveMessage._id)) {
            merged.push(liveMessage);
          }
        }

        return merged;
      });
    } catch (error) {
      console.error("Conversation error:", error);

      setConversation([email]);
    } finally {
      setLoadingConversation(false);
    }
  };

  // =====================================================
  // REPLY
  // =====================================================

  const sendReply = async () => {
    if (!replyText.trim() || !selectedEmail) {
      return;
    }

    try {
      setReplyLoading(true);

      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/emails/${selectedEmail._id}/reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            body: replyText.trim(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send reply");
      }

      setReplyText("");

      await openConversation(selectedEmail);

      if (folder === "inbox") {
        await fetchEmails();
      }

      showToast("Reply sent", "success");
    } catch (error: any) {
      showToast(error.message || "Could not send reply", "error");
    } finally {
      setReplyLoading(false);
    }
  };

  // =====================================================
  // SEND EMAIL
  // =====================================================

  const sendEmail = async () => {
    if (!to.trim() || !body.trim()) {
      showToast("Recipient and message are required", "error");
      return;
    }

    try {
      setSendLoading(true);

      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipients: [to.trim()],
          subject: subject.trim(),
          body: body.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send email");
      }

      setTo("");
      setSubject("");
      setBody("");

      setShowCompose(false);
      setEditingDraft(null);

      setFolder("inbox");

      await fetchEmails();

      showToast("Email sent successfully", "success");
    } catch (error: any) {
      showToast(error.message || "Could not send email", "error");
    } finally {
      setSendLoading(false);
    }
  };

  // =====================================================
  // SAVE DRAFT
  // =====================================================

  const saveDraft = async () => {
    if (!to.trim() && !subject.trim() && !body.trim()) {
      setShowCompose(false);
      return;
    }

    try {
      setDraftLoading(true);

      const token = localStorage.getItem("token");

      if (!token) {
        showToast("You are not logged in", "error");
        return;
      }

      const response = await fetch(`${API_URL}/api/emails/drafts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipients: to.trim() ? [to.trim()] : [],
          subject: subject.trim(),
          body: body.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save draft");
      }

      setTo("");
      setSubject("");
      setBody("");

      setShowCompose(false);
      setEditingDraft(null);

      showToast("Draft saved", "success");

      if (folder === "drafts") {
        await fetchDrafts();
      }
    } catch (error: any) {
      console.error("Save draft error:", error);

      showToast(error.message || "Could not save draft", "error");
    } finally {
      setDraftLoading(false);
    }
  };

  // =====================================================
  // OPEN DRAFT
  // =====================================================

  const openDraft = (draft: any) => {
    setEditingDraft(draft);

    setTo(
      Array.isArray(draft.recipients)
        ? draft.recipients.join(", ")
        : draft.recipient || "",
    );

    setSubject(draft.subject || "");
    setBody(draft.body || "");

    setShowCompose(true);
  };

  // =====================================================
  // SEND EXISTING DRAFT
  // =====================================================

  const sendExistingDraft = async (draft: any) => {
    try {
      setSendLoading(true);

      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/emails/${draft._id}/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send draft");
      }

      setTo("");
      setSubject("");
      setBody("");

      setShowCompose(false);
      setEditingDraft(null);

      setFolder("inbox");

      await fetchEmails();

      showToast("Draft sent successfully", "success");
    } catch (error: any) {
      console.error("Send draft error:", error);

      showToast(error.message || "Could not send draft", "error");
    } finally {
      setSendLoading(false);
    }
  };

  // =====================================================
  // MOVE EMAIL TO TRASH
  // =====================================================

  const moveToTrash = async (email: any) => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/emails/${email._id}/trash`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to move email to trash");
      }

      setEmails((currentEmails) =>
        currentEmails.filter((item) => item._id !== email._id),
      );

      showToast("Moved to trash", "success");
    } catch (error: any) {
      console.error("Trash error:", error);

      showToast(error.message || "Could not move to trash", "error");
    }
  };

  // =====================================================
  // MOVE EMAIL TO SPAM
  // =====================================================

  const moveToSpam = async (email: any) => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/emails/${email._id}/spam`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to move email to spam");
      }

      setEmails((currentEmails) =>
        currentEmails.filter((item) => item._id !== email._id),
      );

      showToast("Moved to spam", "success");
    } catch (error: any) {
      console.error("Spam error:", error);

      showToast(error.message || "Could not move to spam", "error");
    }
  };

  // =====================================================
  // RESTORE EMAIL
  // =====================================================

  const restoreEmail = async (email: any) => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/emails/${email._id}/restore`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to restore email");
      }

      setEmails((currentEmails) =>
        currentEmails.filter((item) => item._id !== email._id),
      );

      showToast("Email restored", "success");
    } catch (error: any) {
      console.error("Restore error:", error);

      showToast(error.message || "Could not restore email", "error");
    }
  };

  // =====================================================
  // PERMANENT DELETE
  // =====================================================

  const permanentlyDeleteEmail = async (email: any) => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/emails/${email._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete email");
      }

      setEmails((currentEmails) =>
        currentEmails.filter((item) => item._id !== email._id),
      );

      showToast("Email permanently deleted", "success");
    } catch (error: any) {
      console.error("Permanent delete error:", error);

      showToast(error.message || "Could not delete email", "error");
    }
  };

  // =====================================================
  // CHANGE FOLDER
  // =====================================================

  const changeFolder = async (newFolder: Folder) => {
    setFolder(newFolder);
    setFilter("All");
    setSearch("");

    await fetchCurrentFolder(newFolder);
  };

  // =====================================================
  // UNREAD COUNT
  // =====================================================

  const unreadCount =
    folder === "inbox"
      ? emails.filter((email) => email.isRead === false).length
      : 0;

  // =====================================================
  // FILTER EMAILS
  // =====================================================

  const filteredEmails = emails.filter((email) => {
    const searchText = search.toLowerCase().trim();

    const recipientsText = Array.isArray(email.recipients)
      ? email.recipients.join(" ")
      : "";

    const matchesSearch =
      !searchText ||
      email.sender?.toLowerCase().includes(searchText) ||
      email.subject?.toLowerCase().includes(searchText) ||
      email.body?.toLowerCase().includes(searchText) ||
      recipientsText.toLowerCase().includes(searchText);

    if (!matchesSearch) {
      return false;
    }

    if (filter === "Unread") {
      return email.isRead === false;
    }

    if (filter === "Favorites") {
      return email.isFavorite === true;
    }

    if (filter === "Attachments") {
      return Array.isArray(email.attachments) && email.attachments.length > 0;
    }

    return true;
  });

  // =====================================================
  // PHONE SCREEN
  // =====================================================

  if (screen === "phone") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.logo}>PhoneMail</Text>

          <Text style={styles.title}>Welcome to{"\n"}PhoneMail</Text>

          <Text style={styles.subtitle}>
            Your phone number is your email ID.
          </Text>

          <Text style={styles.label}>Phone number</Text>

          <View style={styles.phoneBox}>
            <Text style={styles.countryCode}>+91</Text>

            <TextInput
              style={styles.input}
              placeholder="9876543210"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/\D/g, ""))}
            />
          </View>

          {error !== "" && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            disabled={phone.length !== 10 || loading}
            style={[
              styles.button,
              (phone.length !== 10 || loading) && styles.disabledButton,
            ]}
            onPress={sendOTP}
          >
            <Text style={styles.buttonText}>
              {loading ? "Sending..." : "Send OTP"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // =====================================================
  // OTP SCREEN
  // =====================================================

  if (screen === "otp") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.logo}>PhoneMail</Text>

          <Text style={styles.title}>Verify your number</Text>

          <Text style={styles.subtitle}>Enter the OTP sent to</Text>

          <Text style={styles.phoneText}>+91 {phone}</Text>

          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/\D/g, ""))}
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
          />

          {error !== "" && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            disabled={otp.length !== 6 || loading}
            style={[
              styles.button,
              (otp.length !== 6 || loading) && styles.disabledButton,
            ]}
            onPress={verifyOTP}
          >
            <Text style={styles.buttonText}>
              {loading ? "Verifying..." : "Verify OTP"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setError("");
              setScreen("phone");
            }}
          >
            <Text style={styles.changeNumber}>Change number</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // =====================================================
  // CONVERSATION SCREEN
  // =====================================================

  if (screen === "conversation") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.conversation}>
          <View style={styles.conversationHeader}>
            <TouchableOpacity
              onPress={() => {
                setScreen("home");
                setReplyText("");
              }}
            >
              <Text style={styles.backButton}>←</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.conversationTitle}>
                {selectedEmail?.sender}
              </Text>

              <Text style={styles.conversationSubject}>
                {selectedEmail?.subject || "(No subject)"}
              </Text>
            </View>

            {folder === "inbox" && (
              <TouchableOpacity
                style={styles.conversationFavoriteButton}
                onPress={() => {
                  if (selectedEmail) {
                    toggleFavorite(selectedEmail);
                  }
                }}
              >
                <Text
                  style={[
                    styles.conversationFavorite,
                    selectedEmail?.isFavorite &&
                      styles.conversationFavoriteActive,
                  ]}
                >
                  {selectedEmail?.isFavorite ? "★ Favorite" : "☆ Favorite"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingConversation ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Loading...</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingVertical: 15,
              }}
              showsVerticalScrollIndicator={false}
            >
              {conversation.map((message, index) => (
                <View
                  key={message._id || index}
                  style={[
                    styles.message,
                    message.sender === currentUserPhone
                      ? styles.sentMessage
                      : styles.receivedMessage,
                  ]}
                >
                  <Text style={styles.messageSender}>{message.sender}</Text>

                  <Text style={styles.messageBody}>{message.body}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {folder === "inbox" && (
            <View style={styles.replyBox}>
              <TextInput
                style={styles.replyInput}
                placeholder="Write a reply..."
                placeholderTextColor="#888"
                multiline
                value={replyText}
                onChangeText={setReplyText}
              />

              <TouchableOpacity
                style={[
                  styles.replyButton,
                  (!replyText.trim() || replyLoading) && styles.disabledButton,
                ]}
                disabled={!replyText.trim() || replyLoading}
                onPress={sendReply}
              >
                <Text style={styles.replyButtonText}>
                  {replyLoading ? "Sending" : "✈ Send"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // =====================================================
  // HOME
  // =====================================================

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.home}>
        {/* HEADER */}

        <View style={styles.homeHeader}>
          <View>
            <Text style={styles.homeLogo}>PhoneMail</Text>

            {currentUserPhone !== "" && (
              <Text style={styles.loggedInPhone}>+91 {currentUserPhone}</Text>
            )}
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => fetchCurrentFolder()}
            >
              <Text style={styles.refreshText}>↻ Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =====================================================
            ENTIRE HOME / FOLDER CONTENT IS SCROLLABLE
        ===================================================== */}

        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={styles.homeScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.homeTitle}>
            {folder === "inbox"
              ? `Conversations${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`
              : folder === "drafts"
                ? "Drafts"
                : folder === "trash"
                  ? "Trash"
                  : "Spam"}
          </Text>

          {/* SEARCH */}

          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search phone number, subject or message"
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* FOLDER NAVIGATION */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.folderScroll}
            contentContainerStyle={styles.horizontalContent}
          >
            {[
              {
                id: "inbox" as Folder,
                label: "Home",
              },
              {
                id: "drafts" as Folder,
                label: "Drafts",
              },
              {
                id: "spam" as Folder,
                label: "🚫 Spam",
              },
              {
                id: "trash" as Folder,
                label: "🗑️ Trash",
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => changeFolder(item.id)}
                style={[
                  styles.folderButton,
                  folder === item.id && styles.activeFolderButton,
                ]}
              >
                <Text
                  style={[
                    styles.folderText,
                    folder === item.id && styles.activeFolderText,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* INBOX FILTERS */}

          {folder === "inbox" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.horizontalContent}
            >
              {["All", "Unread", "Attachments", "Favorites"].map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[
                    styles.filter,
                    filter === item && styles.activeFilter,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filter === item && styles.activeFilterText,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* EMAIL LIST */}

          {loadingEmails ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Loading...</Text>
            </View>
          ) : filteredEmails.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>—</Text>

              <Text style={styles.emptyTitle}>
                {folder === "drafts"
                  ? "No drafts"
                  : folder === "trash"
                    ? "Trash is empty"
                    : folder === "spam"
                      ? "Spam is empty"
                      : filter === "Unread"
                        ? "No unread emails"
                        : filter === "Favorites"
                          ? "No favorite emails"
                          : "No conversations"}
              </Text>

              <Text style={styles.emptyText}>
                {folder === "drafts"
                  ? "Saved messages will appear here."
                  : folder === "trash"
                    ? "Deleted emails will appear here."
                    : folder === "spam"
                      ? "Spam emails will appear here."
                      : filter === "Favorites"
                        ? "Save an email to add it here."
                        : "Start a conversation using a phone number."}
              </Text>
            </View>
          ) : (
            filteredEmails.map((email) => (
              <View
                key={email._id}
                style={[
                  styles.emailCard,
                  !email.isRead && folder === "inbox" && styles.unreadCard,
                ]}
              >
                <TouchableOpacity
                  style={styles.emailMain}
                  onPress={() => openConversation(email)}
                >
                  <View style={styles.emailAvatar}>
                    <Text style={styles.emailAvatarText}>
                      {(email.sender || "D")[0].toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.emailTop}>
                      <Text style={styles.sender} numberOfLines={1}>
                        {folder === "drafts"
                          ? email.recipients?.join(", ") || "Draft"
                          : email.sender}
                      </Text>
                    </View>

                    <Text style={styles.subject} numberOfLines={1}>
                      {email.subject || "(No subject)"}
                    </Text>

                    <Text style={styles.preview} numberOfLines={1}>
                      {email.body || "No message"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* INBOX ACTIONS */}

                {folder === "inbox" && (
                  <View style={styles.inboxActions}>
                    <TouchableOpacity
                      style={styles.favoriteButton}
                      onPress={() => toggleFavorite(email)}
                    >
                      <Text
                        style={[
                          styles.favorite,
                          email.isFavorite && styles.favoriteActive,
                        ]}
                      >
                        {email.isFavorite ? "★" : "☆"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.smallDangerButton}
                      onPress={() => moveToSpam(email)}
                    >
                      <Text style={styles.smallDangerText}>Spam</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.smallDangerButton}
                      onPress={() => moveToTrash(email)}
                    >
                      <Text style={styles.smallDangerText}>Trash</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* DRAFT ACTIONS */}

                {folder === "drafts" && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.smallActionButton}
                      onPress={() => sendExistingDraft(email)}
                    >
                      <Text style={styles.smallActionText}>✈ Send</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.smallDangerButton}
                      onPress={() => moveToTrash(email)}
                    >
                      <Text style={styles.smallDangerText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* TRASH ACTIONS */}

                {folder === "trash" && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.smallActionButton}
                      onPress={() => restoreEmail(email)}
                    >
                      <Text style={styles.smallActionText}>Restore</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.smallDangerButton}
                      onPress={() => permanentlyDeleteEmail(email)}
                    >
                      <Text style={styles.smallDangerText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* SPAM ACTIONS */}

                {folder === "spam" && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.smallActionButton}
                      onPress={() => restoreEmail(email)}
                    >
                      <Text style={styles.smallActionText}>Restore</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.smallDangerButton}
                      onPress={() => permanentlyDeleteEmail(email)}
                    >
                      <Text style={styles.smallDangerText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}

          {/* EXTRA SPACE AT BOTTOM FOR COMPOSE BUTTON */}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* COMPOSE BUTTON */}

        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => {
            setEditingDraft(null);
            setTo("");
            setSubject("");
            setBody("");
            setShowCompose(true);
          }}
        >
          <Text style={styles.composeText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* =====================================================
          COMPOSE MODAL
      ===================================================== */}

      {showCompose && (
        <View style={styles.composeOverlay}>
          <View style={styles.composeModal}>
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>
                {editingDraft ? "Draft" : "New message"}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setShowCompose(false);
                  setEditingDraft(null);
                }}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.composeInput}
              placeholder="To: phone number"
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              value={to}
              onChangeText={setTo}
            />

            <TextInput
              style={styles.composeInput}
              placeholder="Subject"
              placeholderTextColor="#888"
              value={subject}
              onChangeText={setSubject}
            />

            <TextInput
              style={styles.composeBody}
              placeholder="Write your message..."
              placeholderTextColor="#888"
              multiline
              value={body}
              onChangeText={setBody}
            />

            <View style={styles.composeActions}>
              <TouchableOpacity
                style={[
                  styles.draftButton,
                  draftLoading && styles.disabledButton,
                ]}
                disabled={draftLoading}
                onPress={saveDraft}
              >
                <Text style={styles.draftButtonText}>
                  {draftLoading ? "Saving..." : "Save draft"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sendComposeButton,
                  sendLoading && styles.disabledButton,
                ]}
                disabled={sendLoading}
                onPress={() => {
                  if (editingDraft) {
                    sendExistingDraft(editingDraft);
                  } else {
                    sendEmail();
                  }
                }}
              >
                <Text style={styles.buttonText}>
                  {sendLoading ? "Sending..." : "✈ Send"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* =====================================================
          TOAST
      ===================================================== */}

      {toast.visible && (
        <View
          style={[
            styles.toast,
            toast.type === "success" && styles.successToast,
            toast.type === "error" && styles.errorToast,
            toast.type === "info" && styles.infoToast,
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9FF",
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
  },

  logo: {
    fontSize: 30,
    fontWeight: "800",
    color: PURPLE,
    marginBottom: 35,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#181818",
    lineHeight: 38,
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: "#777",
    lineHeight: 22,
    marginBottom: 32,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
    marginBottom: 8,
  },

  phoneBox: {
    height: 60,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 15,
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
  },

  countryCode: {
    fontSize: 16,
    fontWeight: "700",
    color: PURPLE,
    marginRight: 14,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: "#222",
  },

  button: {
    height: 55,
    backgroundColor: PURPLE,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  disabledButton: {
    opacity: 0.4,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  otpInput: {
    height: 65,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 15,
    backgroundColor: "#FFF",
    textAlign: "center",
    fontSize: 25,
    letterSpacing: 8,
    color: "#222",
  },

  phoneText: {
    color: PURPLE,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 25,
  },

  changeNumber: {
    textAlign: "center",
    color: PURPLE,
    fontWeight: "600",
    marginTop: 20,
  },

  error: {
    color: "#D32F2F",
    marginTop: 12,
    fontSize: 13,
  },

  // =====================================================
  // HOME
  // =====================================================

  home: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  homeLogo: {
    fontSize: 28,
    fontWeight: "800",
    color: PURPLE,
  },

  loggedInPhone: {
    fontSize: 11,
    color: "#888",
    marginTop: 2,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  refreshButton: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#EEEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  refreshText: {
    color: PURPLE,
    fontSize: 12,
    fontWeight: "700",
  },

  logoutButton: {
    marginLeft: 8,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },

  logoutText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  homeScroll: {
    flex: 1,
  },

  homeScrollContent: {
    paddingBottom: 20,
  },

  homeTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#222",
    marginBottom: 18,
  },

  searchBox: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#EEEAFE",
    paddingHorizontal: 15,
    justifyContent: "center",
  },

  searchInput: {
    fontSize: 14,
    color: "#222",
  },

  folderScroll: {
    marginVertical: 12,
    flexGrow: 0,
  },

  horizontalContent: {
    paddingRight: 10,
  },

  folderButton: {
    backgroundColor: "#EEEAFE",
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
  },

  activeFolderButton: {
    backgroundColor: PURPLE,
  },

  folderText: {
    color: "#555",
    fontSize: 12,
    fontWeight: "600",
  },

  activeFolderText: {
    color: "#FFF",
    fontWeight: "700",
  },

  filterScroll: {
    marginBottom: 12,
    flexGrow: 0,
  },

  filter: {
    backgroundColor: "#EEEAFE",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
  },

  filterText: {
    color: "#555",
    fontSize: 12,
  },

  activeFilter: {
    backgroundColor: PURPLE,
  },

  activeFilterText: {
    color: "#FFF",
    fontWeight: "700",
  },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingBottom: 100,
  },

  emptyIcon: {
    fontSize: 40,
    color: "#AAA",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    color: "#333",
  },

  emptyText: {
    color: "#888",
    marginTop: 8,
    textAlign: "center",
  },

  // =====================================================
  // EMAIL CARD
  // =====================================================

  emailCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEEAFE",
  },

  unreadCard: {
    borderColor: BORDER,
    borderWidth: 1.5,
  },

  emailMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  emailAvatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "#EEEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  emailAvatarText: {
    color: PURPLE,
    fontSize: 17,
    fontWeight: "800",
  },

  emailTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  sender: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
  },

  favoriteButton: {
    minWidth: 50,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },

  favorite: {
    color: "#999",
    fontSize: 25,
    fontWeight: "400",
  },

  favoriteActive: {
    color: PURPLE,
  },

  subject: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginTop: 3,
  },

  preview: {
    fontSize: 12,
    color: "#888",
    marginTop: 3,
  },

  inboxActions: {
    alignItems: "flex-end",
    marginLeft: 8,
  },

  cardActions: {
    alignItems: "flex-end",
    marginLeft: 8,
  },

  smallActionButton: {
    backgroundColor: "#EEEAFE",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 5,
  },

  smallActionText: {
    color: PURPLE,
    fontSize: 11,
    fontWeight: "700",
  },

  smallDangerButton: {
    backgroundColor: "#FBEAEA",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  smallDangerText: {
    color: "#C62828",
    fontSize: 11,
    fontWeight: "700",
  },

  // =====================================================
  // COMPOSE
  // =====================================================

  composeButton: {
    position: "absolute",
    right: 25,
    bottom: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },

  composeText: {
    color: "#FFF",
    fontSize: 32,
    fontWeight: "300",
  },

  composeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },

  composeModal: {
    backgroundColor: "#FAF9FF",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    minHeight: 430,
  },

  composeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  composeTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#222",
  },

  closeText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "600",
  },

  composeInput: {
    height: 50,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    fontSize: 14,
  },

  composeBody: {
    height: 130,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    textAlignVertical: "top",
  },

  composeActions: {
    flexDirection: "row",
    marginTop: 15,
  },

  draftButton: {
    flex: 1,
    height: 50,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  draftButtonText: {
    color: PURPLE,
    fontWeight: "700",
    fontSize: 14,
  },

  sendComposeButton: {
    flex: 1,
    height: 50,
    backgroundColor: PURPLE,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // =====================================================
  // CONVERSATION
  // =====================================================

  conversation: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEAFE",
  },

  backButton: {
    fontSize: 24,
    color: PURPLE,
    fontWeight: "700",
    marginRight: 15,
  },

  conversationTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },

  conversationSubject: {
    fontSize: 13,
    color: "#777",
    marginTop: 3,
  },

  conversationFavoriteButton: {
    minWidth: 75,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    paddingHorizontal: 9,
  },

  conversationFavorite: {
    fontSize: 10,
    color: "#777",
    fontWeight: "700",
  },

  conversationFavoriteActive: {
    color: PURPLE,
  },

  message: {
    maxWidth: "82%",
    padding: 13,
    borderRadius: 16,
    marginBottom: 10,
  },

  sentMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#E6DEFF",
  },

  receivedMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEEAFE",
  },

  messageSender: {
    fontSize: 11,
    color: PURPLE,
    fontWeight: "700",
    marginBottom: 5,
  },

  messageBody: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },

  replyBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEEAFE",
  },

  replyInput: {
    flex: 1,
    minHeight: 45,
    maxHeight: 100,
    backgroundColor: "#EEEAFE",
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },

  replyButton: {
    height: 45,
    paddingHorizontal: 15,
    marginLeft: 8,
    borderRadius: 15,
    backgroundColor: PURPLE,
    justifyContent: "center",
    alignItems: "center",
  },

  replyButtonText: {
    color: "#FFF",
    fontWeight: "700",
  },

  // =====================================================
  // TOAST
  // =====================================================

  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 25,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    elevation: 8,
  },

  successToast: {
    backgroundColor: "#2E7D32",
  },

  errorToast: {
    backgroundColor: "#C62828",
  },

  infoToast: {
    backgroundColor: "#333",
  },

  toastText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
