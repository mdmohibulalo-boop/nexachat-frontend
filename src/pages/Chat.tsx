import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import axios from "axios";

import VoiceHoldRecorder from "../components/chat/VoiceHoldRecorder";
import VoiceMessageBubble from "../components/chat/VoiceMessageBubble";
import Navbar from "../components/Navbar";

type ChatItem = {
  conversationId: string;
  userId: string;
  name?: string;
  username?: string;
  lastMessage: string;
  lastMessageTime: string;
  isSeen: boolean;
  unreadCount?: number;
  profilePic?: string;
};

type SelectedUser = {
  conversationId?: string;
  userId: string;
  name: string;
  username?: string;
  profilePic?: string; // ✅ ADDED
};

type MsgStatus = "sending" | "sent" | "delivered" | "seen";

type Msg = {
  _id?: string;
  tempId?: string;
  text: string;
  self: boolean;
  timestamp?: string;

  status?: MsgStatus;

  isDelivered?: boolean;
  isSeen: boolean;
  seenAt?: string | null;

  // ✅ reply UI info
  replyToText?: string | null;
  replyToSelf?: boolean;

  // ✅ DELETE SYSTEM
  isDeletedForEveryone?: boolean;
  deletedFor?: string[];
};

export default function Chat() {
  const userData = JSON.parse(sessionStorage.getItem("user") || "{}");
  const socketRef = useRef<Socket | null>(null);

  const navigate = useNavigate();

  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [chatList, setChatList] = useState<ChatItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<Msg[]>([]);

  // ✅ ONLINE / LAST SEEN STATES
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // ✅ TYPING INDICATOR STATES
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // ✅ TEXTAREA AUTO GROW REF
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // ✅ FILE UPLOAD STATES
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // ✅ SEARCH STATES
  const [searchText, setSearchText] = useState("");
  const [searchResult, setSearchResult] = useState<SelectedUser | null>(null);
  const [notFound, setNotFound] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedUserRef = useRef<SelectedUser | null>(null);

  // ✅✅✅ force rerender so "Seen X minutes ago" updates realtime
  const [, forceSeenRender] = useState(0);

  /**
   * =============================================
   * ✅ REPLY SYSTEM (Swipe + Desktop Button)
   * =============================================
   */
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);

  // ✅ delete menu popup state
  const [deleteMenuMsg, setDeleteMenuMsg] = useState<Msg | null>(null);

  // ✅ confirm modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    msg: Msg | null;
  }>({
    open: false,
    msg: null,
  });

  const swipeStartXRef = useRef<number | null>(null);
  const swipeLastXRef = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 65;

  const openDeleteConfirm = (msg: Msg) => {
    setDeleteConfirm({ open: true, msg });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, msg: null });
  };

  // ✅ 15 minutes rule
  const isDeleteForEveryoneAllowed = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return now - created <= 15 * 60 * 1000;
  };

  const onMsgTouchStart = (e: React.TouchEvent) => {
    swipeStartXRef.current = e.touches[0].clientX;
    swipeLastXRef.current = e.touches[0].clientX;
  };

  const onMsgTouchMove = (e: React.TouchEvent) => {
    swipeLastXRef.current = e.touches[0].clientX;
  };

  const onMsgTouchEnd = (msg: Msg) => {
    const startX = swipeStartXRef.current;
    const endX = swipeLastXRef.current;

    swipeStartXRef.current = null;
    swipeLastXRef.current = null;

    if (startX === null || endX === null) return;

    const diff = endX - startX;

    if (diff > SWIPE_THRESHOLD) {
      setReplyingTo(msg);
      setTimeout(() => textAreaRef.current?.focus(), 50);
    }
  };

  const cancelReply = () => setReplyingTo(null);

  const setReplyFromDesktop = (msg: Msg) => {
    setReplyingTo(msg);
    setTimeout(() => textAreaRef.current?.focus(), 50);
  };

  const getReplyPreview = (text: string) => {
    if (text.startsWith("[file-image]")) return "📷 Photo";
    if (text.startsWith("[file-video]")) return "🎥 Video";
    if (text.startsWith("[file-pdf]")) return "📄 Document";
    if (text.startsWith("[file-audio]")) return "🎤 Voice Note";
    if (text.startsWith("[file]")) return "📎 File";
    return text.length > 70 ? text.slice(0, 70) + "..." : text;
  };

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ✅ realtime update every 30 sec
  useEffect(() => {
    const t = setInterval(() => {
      forceSeenRender((x) => x + 1);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const INPUT_HEIGHT = 38;
  const INPUT_MAX_HEIGHT = 110;

  const autoResizeTextarea = () => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, INPUT_MAX_HEIGHT) + "px";
  };

  const resetTextareaHeight = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = INPUT_HEIGHT + "px";
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatSeenAgo = (seenISO?: string) => {
    if (!seenISO) return "";
    const now = Date.now();
    const seenTime = new Date(seenISO).getTime();
    let diffSec = Math.floor((now - seenTime) / 1000);
    if (diffSec < 0) diffSec = 0;
    if (diffSec < 60) return "Seen just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)
      return `Seen ${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)
      return `Seen ${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `Seen ${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  };

  const formatLastSeen = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHr = Math.floor(diffMin / 60);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLastMessageLabel = (text: string) => {
    if (text.startsWith("[file-image]")) return "📷 Photo";
    if (text.startsWith("[file-video]")) return "🎥 Video";
    if (text.startsWith("[file-pdf]")) return "📄 Document";
    if (text.startsWith("[file-audio]")) return "🎤 Voice Note";
    if (text.startsWith("[file]")) return "📎 File";
    return text;
  };

  const bumpChatToTop = (otherUserId: string, text: string) => {
    setChatList((prev) => {
      const nowISO = new Date().toISOString();
      const idx = prev.findIndex((c) => c.userId === otherUserId);

      if (idx !== -1) {
        const updatedChat: ChatItem = {
          ...prev[idx],
          lastMessage: getLastMessageLabel(text),
          lastMessageTime: nowISO,
        };

        const newList = [...prev];
        newList.splice(idx, 1);
        return [updatedChat, ...newList];
      }
      return prev;
    });
  };

  const loadChatList = async () => {
    try {
      const res = await axios.get(
        `https://mahi-0iap.onrender.com/api/conversations/${userData.id}`
      );
      setChatList(res.data.chats || []);
    } catch (err) {
      console.log("Chat list load error:", err);
      setChatList([]);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await axios.get(
        `https://mahi-0iap.onrender.com/api/messages/conversation/${conversationId}`
      );

      const formatted: Msg[] = (res.data.messages || []).map((m: any) => {
        const sender = m.sender?.toString?.() ?? m.sender ?? "";
        const isSelf = sender === userData.id;

        const delivered = m.deliveredAt ? true : false;
        const seen = m.seenAt ? true : false;

        let status: MsgStatus = "sent";
        if (seen) status = "seen";
        else if (delivered) status = "delivered";

        const textToShow = m.isDeletedForEveryone
          ? "🚫 This message was deleted"
          : m.message;

        return {
          _id: m._id,
          text: textToShow,
          self: isSelf,
          timestamp: m.createdAt,
          isDelivered: delivered,
          isSeen: seen,
          seenAt: m.seenAt || null,
          status,

          replyToText: m.replyText || null,
          replyToSelf: m.replyToSelf || false,

          isDeletedForEveryone: m.isDeletedForEveryone || false,
          deletedFor: m.deletedFor || [],
        };
      });

      const filtered = formatted.filter(
        (m) => !(m.deletedFor || []).includes(userData.id)
      );

      setChatMessages(filtered);
    } catch (err) {
      console.log("Load messages error:", err);
      setChatMessages([]);
    }
  };

  const closeChat = () => {
    const socket = socketRef.current;
    socket?.emit("chatClose", { viewerId: userData.id });

    setSelectedUser(null);
    selectedUserRef.current = null;
    setChatMessages([]);

    setSearchResult(null);
    setSearchText("");
    setNotFound(false);

    setSelectedFile(null);

    setTypingUserId(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    setLastSeen(null);
    setReplyingTo(null);
    setDeleteMenuMsg(null);
    closeDeleteConfirm();

    resetTextareaHeight();
    loadChatList();
  };

  const handleTyping = () => {
    if (!selectedUser) return;
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("typing", {
      fromUserId: userData.id,
      toUserId: selectedUser.userId,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", {
        fromUserId: userData.id,
        toUserId: selectedUser.userId,
      });
    }, 1600);
  };

  const forceStopTyping = () => {
    if (!selectedUser) return;
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("stopTyping", {
      fromUserId: userData.id,
      toUserId: selectedUser.userId,
    });
  };

  useEffect(() => {
    if (!userData?.id) return;

    if (!socketRef.current) {
      socketRef.current = io("https://mahi-0iap.onrender.com", {
        transports: ["websocket"],
      });
    }

    const socket = socketRef.current;

    socket.emit("joinUser", {
      userId: userData.id,
      name: userData.name,
      username: userData.username,
    });

    socket.off("onlineUsers");
    socket.off("receivePrivateMessage");
    socket.off("messageSent");
    socket.off("messageDelivered");
    socket.off("messagesSeen");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("messageDeleted");

    const handleOnlineUsers = (users: any[]) => {
      const unique = Array.from(
        new Map(users.map((u: any) => [u.userId, u])).values()
      );
      setOnlineUsers(unique);
    };

    const handleReceiveMessage = (data: any) => {
      const current = selectedUserRef.current;
      const senderId = data.sender?.toString?.() ?? data.sender ?? "";
      const isCurrentChat = current?.userId === senderId;

      bumpChatToTop(senderId, data.message);

      if (isCurrentChat) {
        setChatMessages((prev) => [
          ...prev,
          {
            _id: data._id,
            text: data.message,
            self: false,
            timestamp: data.createdAt,
            isDelivered: true,
            isSeen: data.seenAt ? true : false,
            seenAt: data.seenAt || null,
            status: "delivered",

            replyToText: data.replyText || null,
            replyToSelf: data.replyToSelf || false,
          },
        ]);

        socket.emit("markSeen", {
          senderId,
          receiverId: userData.id,
        });
      }

      setTimeout(() => loadChatList(), 250);
    };

    const handleMessageSent = ({ tempId, messageId, createdAt }: any) => {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId
            ? {
                ...m,
                _id: messageId,
                timestamp: createdAt || m.timestamp,
                status: "sent",
              }
            : m
        )
      );
    };

    const handleDelivered = ({ messageId }: any) => {
      setChatMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, isDelivered: true, status: "delivered" }
            : m
        )
      );
    };

    const handleMessagesSeen = ({ senderId, receiverId, seenAt }: any) => {
      if (senderId !== userData.id) return;

      const current = selectedUserRef.current;
      if (!current || current.userId !== receiverId) return;

      const t = seenAt || new Date().toISOString();

      setChatMessages((prev) =>
        prev.map((m) =>
          m.self ? { ...m, isSeen: true, seenAt: t, status: "seen" } : m
        )
      );

      setTimeout(() => loadChatList(), 200);
    };

    const handleTypingEvent = ({ fromUserId }: any) => {
      const current = selectedUserRef.current;
      if (!current) return;
      if (String(current.userId) === String(fromUserId)) {
        setTypingUserId(String(fromUserId));
      }
    };

    const handleStopTypingEvent = ({ fromUserId }: any) => {
      const current = selectedUserRef.current;
      if (!current) return;
      if (String(current.userId) === String(fromUserId)) {
        setTypingUserId(null);
      }
    };

    const handleMessageDeleted = ({ messageId, deleteForEveryone }: any) => {
      if (!messageId) return;

      if (deleteForEveryone) {
        setChatMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? {
                  ...m,
                  text: "🚫 This message was deleted",
                  isDeletedForEveryone: true,
                }
              : m
          )
        );
      } else {
        setChatMessages((prev) =>
          prev.filter((m) => String(m._id) !== String(messageId))
        );
      }
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("receivePrivateMessage", handleReceiveMessage);

    socket.on("messageSent", handleMessageSent);
    socket.on("messageDelivered", handleDelivered);
    socket.on("messagesSeen", handleMessagesSeen);

    socket.on("typing", handleTypingEvent);
    socket.on("stopTyping", handleStopTypingEvent);

    socket.on("messageDeleted", handleMessageDeleted);

    loadChatList();
  }, [userData?.id]);

  const selectedIsOnline =
    !!selectedUser &&
    onlineUsers.some((u) => String(u.userId) === String(selectedUser.userId));

  useEffect(() => {
    if (!selectedUser?.userId) return;

    if (selectedIsOnline) {
      setLastSeen(null);
      return;
    }

    axios
      .get(`https://mahi-0iap.onrender.com/api/user/status/${selectedUser.userId}`)
      .then((res) => setLastSeen(res.data.lastSeen || null))
      .catch(() => setLastSeen(null));
  }, [selectedUser?.userId, selectedIsOnline]);

  const openChatByUser = async (user: SelectedUser) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("chatClose", { viewerId: userData.id });

    setSelectedUser({
      ...user,
      profilePic: user.profilePic || "",
    });

    setTypingUserId(null);
    setLastSeen(null);
    setReplyingTo(null);
    setDeleteMenuMsg(null);
    closeDeleteConfirm();

    if (user.conversationId) await loadMessages(user.conversationId);
    else setChatMessages([]);

    socket.emit("chatOpen", { viewerId: userData.id, otherId: user.userId });

    socket.emit("markSeen", { senderId: user.userId, receiverId: userData.id });

    loadChatList();

    setSearchResult(null);
    setSearchText("");
    setNotFound(false);
    setSelectedFile(null);

    resetTextareaHeight();
  };

  const searchUser = async () => {
    if (!searchText.trim()) return;

    try {
      const res = await axios.get(
        `https://mahi-0iap.onrender.com/api/auth/search/${searchText}`
      );

      setSearchResult({
        userId: res.data.user.userId,
        name: res.data.user.name,
        username: res.data.user.username,
        profilePic: res.data.user.profilePic || "",
      });

      setNotFound(false);
    } catch {
      setSearchResult(null);
      setNotFound(true);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("https://mahi-0iap.onrender.com/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return res.data?.file?.url || null;
    } catch (err) {
      console.log("Upload failed:", err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const getFileTag = (file: File) => {
    if (file.type.startsWith("image/")) return "[file-image]";
    if (file.type.startsWith("video/")) return "[file-video]";
    if (file.type === "application/pdf") return "[file-pdf]";
    if (file.type.startsWith("audio/")) return "[file-audio]";
    return "[file]";
  };

  const sendMessage = async () => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!selectedUser) return;

    forceStopTyping();

    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    if (selectedFile) {
      const fileUrl = await uploadFile(selectedFile);
      if (!fileUrl) return;

      const tag = getFileTag(selectedFile);
      const fileMsg = `${tag}${fileUrl}`;

      socket.emit("privateMessage", {
        senderId: userData.id,
        receiverId: selectedUser.userId,
        message: fileMsg,
        tempId,
        replyToId: replyingTo?._id || null,
        replyText: replyingTo?.text || null,
        replyToSelf: replyingTo?.self || false,
      });

      bumpChatToTop(selectedUser.userId, fileMsg);

      setChatMessages((prev) => [
        ...prev,
        {
          tempId,
          _id: tempId,
          text: fileMsg,
          self: true,
          isSeen: false,
          isDelivered: false,
          seenAt: null,
          timestamp: new Date().toISOString(),
          status: "sending",

          replyToText: replyingTo?.text || null,
          replyToSelf: replyingTo?.self || false,
        },
      ]);

      setSelectedFile(null);
      setReplyingTo(null);
      setTimeout(() => loadChatList(), 250);
      return;
    }

    if (!message.trim()) return;

    socket.emit("privateMessage", {
      senderId: userData.id,
      receiverId: selectedUser.userId,
      message,
      tempId,
      replyToId: replyingTo?._id || null,
      replyText: replyingTo?.text || null,
      replyToSelf: replyingTo?.self || false,
    });

    bumpChatToTop(selectedUser.userId, message);

    setChatMessages((prev) => [
      ...prev,
      {
        tempId,
        _id: tempId,
        text: message,
        self: true,
        isSeen: false,
        isDelivered: false,
        seenAt: null,
        timestamp: new Date().toISOString(),
        status: "sending",

        replyToText: replyingTo?.text || null,
        replyToSelf: replyingTo?.self || false,
      },
    ]);

    setMessage("");
    setReplyingTo(null);

    setTimeout(() => resetTextareaHeight(), 0);
    setTimeout(() => loadChatList(), 250);
  };

  const deleteForMe = (msg: Msg) => {
    if (!msg._id || !selectedUser) return;

    socketRef.current?.emit("deleteMessage", {
      messageId: msg._id,
      userId: userData.id,
      otherUserId: selectedUser.userId,
      deleteForEveryone: false,
    });

    setChatMessages((prev) =>
      prev.filter((m) => String(m._id) !== String(msg._id))
    );
  };

  const deleteForEveryone = (msg: Msg) => {
    if (!msg._id || !selectedUser) return;

    socketRef.current?.emit("deleteMessage", {
      messageId: msg._id,
      userId: userData.id,
      otherUserId: selectedUser.userId,
      deleteForEveryone: true,
    });

    setChatMessages((prev) =>
      prev.map((m) =>
        String(m._id) === String(msg._id)
          ? {
              ...m,
              text: "🚫 This message was deleted",
              isDeletedForEveryone: true,
            }
          : m
      )
    );
  };

  const renderMessage = (m: Msg) => {
    if (m.text.startsWith("[file-image]")) {
      const url = m.text.replace("[file-image]", "");
      return (
        <img
          src={url}
          alt="img"
          style={{ maxWidth: 230, borderRadius: 10, cursor: "pointer" }}
          onClick={() => window.open(url, "_blank")}
        />
      );
    }

    if (m.text.startsWith("[file-video]")) {
      const url = m.text.replace("[file-video]", "");
      return (
        <video src={url} controls style={{ maxWidth: 260, borderRadius: 10 }} />
      );
    }

    if (m.text.startsWith("[file-pdf]")) {
      const url = m.text.replace("[file-pdf]", "");
      return (
        <a href={url} target="_blank" rel="noreferrer">
          📄 Open Document
        </a>
      );
    }

    if (m.text.startsWith("[file-audio]")) {
      const url = m.text.replace("[file-audio]", "");
      return <VoiceMessageBubble url={url} self={m.self} />;
    }

    if (m.text.startsWith("[file]")) {
      const url = m.text.replace("[file]", "");
      return (
        <a href={url} target="_blank" rel="noreferrer">
          📎 Download File
        </a>
      );
    }

    return <div>{m.text}</div>;
  };

  const getStatusLabel = (m: Msg) => {
    if (!m.self) return "";
    if (m.status === "sending") return "Sending…";
    if (m.status === "sent") return "Sent";
    if (m.status === "delivered") return "Delivered";
    if (m.status === "seen") return "";
    return "";
  };

  return (
    <>
      {/* ✅✅✅ NAVBAR ADDED (only change) */}
     <Navbar
  onLogout={() => {
    socketRef.current?.disconnect();
    socketRef.current = null;

    // ✅ logout = clear session
    sessionStorage.clear();

    // ✅ go to login
    window.location.href = "/login";
  }}
/>
      <div
        style={{ display: "flex", height: "calc(100vh - 60px)" }}
        onClick={() => setDeleteMenuMsg(null)}
      >
        {/* LEFT */}
        <div
          style={{
            width: 340,
           background: "#111b21",
borderRight: "1px solid #2a3942",
            padding: 12,
          }}
        >
          <h3 style={{ marginBottom: 10 }}>Chats</h3>

          {/* SEARCH */}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search username..."
              style={{
                flex: 1,
                padding: 8,
                border: "1px solid #ccc",
                borderRadius: 6,
              }}
            />
            <button onClick={searchUser} style={{ padding: "8px 10px" }}>
              Search
            </button>
          </div>

          {/* ✅✅✅ ONLY CHANGE: SEARCH RESULT DP ADDED */}
          {searchResult && (
            <div
              onClick={() => openChatByUser(searchResult)}
              style={{
                marginTop: 10,
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 6,
                cursor: "pointer",
                background: "white",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "#ddd",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
               {searchResult.profilePic ? (
  <img
    src={
      searchResult.profilePic.startsWith("http")
        ? searchResult.profilePic
        : "https://mahi-0iap.onrender.com" + searchResult.profilePic
    }
    alt="dp"
    style={{
      width: "100%",
      height: "100%",
      objectFit: "cover",
    }}
  />
) : (
  <span style={{ fontSize: 16 }}>👤</span>
)}
              </div>

              <div>
                <b>{searchResult.name}</b>
                <div style={{ fontSize: 12, color: "gray" }}>
                  {searchResult.username ? `@${searchResult.username}` : ""}
                </div>
              </div>
            </div>
          )}

          {notFound && (
            <p style={{ color: "red", marginTop: 10 }}>❌ User Not Found</p>
          )}

          <hr style={{ margin: "15px 0" }} />

          <div style={{ overflowY: "auto", height: "75vh" }}>
            {chatList.length === 0 && (
              <p style={{ color: "gray" }}>No chats yet...</p>
            )}

            {chatList.map((chat) => {
              const isOnline = onlineUsers.some((u) => u.userId === chat.userId);

              return (
                <div
                  key={chat.conversationId}
                  onClick={() =>
                    openChatByUser({
                      conversationId: chat.conversationId,
                      userId: chat.userId,
                      name: chat.name || chat.username || "User",
                      username: chat.username,
                      profilePic: chat.profilePic || "",
                    })
                  }
                  style={{
                    padding: 12,
                    cursor: "pointer",
                    background:
  selectedUser?.userId === chat.userId ? "#2a3942" : "transparent",
border: "none",
                    borderRadius: 10,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* ✅✅✅ PROFILE CLICK ADDED HERE */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/user/${chat.userId}`);
                        }}
                        title="View Profile"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "#ddd",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0,
                          overflow: "hidden",
                        }}
                      >
                        {chat.profilePic ? (
                          <img
  src={
    chat.profilePic.startsWith("http")
      ? chat.profilePic
      : "https://mahi-0iap.onrender.com" + chat.profilePic
  }
  alt="dp"
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }}
/>
                        ) : (
                          <span style={{ fontSize: 16 }}>👤</span>
                        )}
                      </div>

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/user/${chat.userId}`);
                        }}
                        title="View Profile"
                        style={{ cursor: "pointer" }}
                      >
                        {chat.name || chat.username || "User"}
                        {isOnline && (
                          <span style={{ color: "green", marginLeft: 6 }}>●</span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: "gray" }}>
                      {formatTime(chat.lastMessageTime)}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "gray",
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {chat.lastMessage || "No messages yet"}
                    </div>

                    {chat.unreadCount && chat.unreadCount > 0 && (
                      <span
                        style={{
                          background: "green",
                          color: "white",
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 20,
                        }}
                      >
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT */}
       <div
  style={{
    flex: 1,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    height: "100%",
  }}
>
          {!selectedUser && <h2>Select a chat</h2>}

          {selectedUser && (
            <>
              {/* Header */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    borderBottom: "1px solid #ddd",
    marginBottom: 12,
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 10,
  }}
>
                <button
                  onClick={closeChat}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "1px solid #ccc",
                   
                }}
                >
                  ⬅ Back
                </button>

                {/* ✅✅✅ DP ADDED IN HEADER (ONLY CHANGE) */}
                <div
                  onClick={() => navigate(`/user/${selectedUser.userId}`)}
                  title="View Profile"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: "#ddd",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                 {selectedUser.profilePic ? (
  <img
    src={
      selectedUser.profilePic.startsWith("http")
        ? selectedUser.profilePic
        : "https://mahi-0iap.onrender.com" + selectedUser.profilePic
    }
                      alt="dp"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 18 }}>👤</span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  <h2
                    style={{ margin: 0, cursor: "pointer" }}
                    title="View Profile"
                    onClick={() => navigate(`/user/${selectedUser.userId}`)}
                  >
                    {selectedUser.name}
                  </h2>

                  {typingUserId === selectedUser.userId ? (
                    <span style={{ fontSize: 12, color: "green" }}>typing...</span>
                  ) : (
                    <span style={{ fontSize: 12, color: "gray" }}>
                      {selectedIsOnline
                        ? "Online"
                        : lastSeen
                        ? `Active ${formatLastSeen(lastSeen)}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                style={{
                 flex: 1,
                  border: "1px solid #ddd",
                  padding: 12,
                  overflowY: "auto",
                  borderRadius: 12,
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {chatMessages.map((m, i) => {
                  const isLast = i === chatMessages.length - 1;

                  return (
                    <div
                      key={m._id || i}
                      onTouchStart={(e) => onMsgTouchStart(e)}
                      onTouchMove={(e) => onMsgTouchMove(e)}
                      onTouchEnd={() => onMsgTouchEnd(m)}
                     style={{
  alignSelf: m.self ? "flex-end" : "flex-start",
  background: m.self ? "#005c4b" : "#202c33",
  color: "#e9edef",
  padding: "8px 12px",
  borderRadius: 10,
  maxWidth: "75%",
  marginBottom: 8,
  position: "relative",
}}
                    >
                      {/* ✅ Desktop Reply Button */}
                      <button
                        onClick={() => setReplyFromDesktop(m)}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 6,
                          fontSize: 11,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "#0066ff",
                        }}
                        title="Reply"
                      >
                        ↩
                      </button>

                      {/* ✅ Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteMenuMsg(m);
                        }}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 28,
                          fontSize: 11,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "red",
                        }}
                        title="Delete"
                      >
                        🗑
                      </button>

                      {/* ✅ Reply bubble shown inside message */}
                      {m.replyToText && (
                        <div
                          style={{
                            background: "#ffffffaa",
                            borderLeft: "4px solid #0066ff",
                            padding: "6px 8px",
                            borderRadius: 8,
                            marginBottom: 6,
                            fontSize: 12,
                            color: "#333",
                            maxWidth: 240,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: "bold",
                              color: "#0066ff",
                            }}
                          >
                            {m.replyToSelf ? "You" : selectedUser?.name}
                          </div>
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getReplyPreview(m.replyToText)}
                          </div>
                        </div>
                      )}

                      {renderMessage(m)}

                      {/* ✅ Delete menu popup */}
                      {deleteMenuMsg?._id === m._id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: 22,
                            right: 5,
                            background: "white",
                            border: "1px solid #ddd",
                            borderRadius: 10,
                            padding: 8,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            zIndex: 50,
                            minWidth: 180,
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteConfirm(m);
                              setDeleteMenuMsg(null);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: "none",
                              background: "transparent",
                              padding: "6px 8px",
                              cursor: "pointer",
                            }}
                          >
                            🗑 Delete for me
                          </button>

                          {m.self &&
                            m.timestamp &&
                            isDeleteForEveryoneAllowed(m.timestamp) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteConfirm(m);
                                  setDeleteMenuMsg(null);
                                }}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  border: "none",
                                  background: "transparent",
                                  padding: "6px 8px",
                                  cursor: "pointer",
                                  color: "red",
                                }}
                              >
                                🚫 Delete for everyone
                              </button>
                            )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteMenuMsg(null);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              border: "none",
                              background: "transparent",
                              padding: "6px 8px",
                              cursor: "pointer",
                              color: "gray",
                            }}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 10,
                          marginTop: 3,
                          color: "gray",
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 6,
                        }}
                      >
                        <span>{formatTime(m.timestamp)}</span>

                        {m.self && !m.isSeen && (
                          <span style={{ fontSize: 10, color: "#888" }}>
                            {getStatusLabel(m)}
                          </span>
                        )}
                      </div>

                      {isLast && m.self && m.isSeen && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "gray",
                            marginTop: 4,
                            textAlign: "right",
                          }}
                        >
                          {formatSeenAgo(m.seenAt || m.timestamp)}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Preview */}
              {replyingTo && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "#f5faff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#0066ff" }}>
                      Replying to {replyingTo.self ? "You" : selectedUser?.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "gray",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getReplyPreview(replyingTo.text)}
                    </div>
                  </div>

                  <button
                    onClick={cancelReply}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 18,
                      cursor: "pointer",
                      color: "gray",
                    }}
                  >
                    ❌
                  </button>
                </div>
              )}

             {/* Input Row */}
<div
  style={{
    display: "flex",
    gap: 10,
    marginTop: 12,
    alignItems: "flex-end",
    position: "sticky",
    bottom: 0,
  
    paddingTop: 10,
  }}
>
                <label
                  style={{
                    width: INPUT_HEIGHT,
                    height: INPUT_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                   border: "1px solid #2a3942",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: "#202c33",
                    flexShrink: 0,
                  }}
                >
                  📎
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf,*/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                  />
                </label>

                <textarea
                  ref={textAreaRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    autoResizeTextarea();
                    handleTyping();
                  }}
                  onBlur={() => forceStopTyping()}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "1px solid #2a3942",
background: "#202c33",
color: "#e9edef",
                    resize: "none",
                    overflow: "hidden",
                    minHeight: INPUT_HEIGHT,
                    maxHeight: INPUT_MAX_HEIGHT,
                    lineHeight: "18px",
                    fontSize: 14,
                  }}
                  rows={1}
                  disabled={uploading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />

                <button
                  onClick={sendMessage}
                  disabled={uploading}
                  style={{
                    height: INPUT_HEIGHT,
                    alignSelf: "flex-end",
                    padding: "0 16px",
                    background: uploading ? "gray" : "#0066ff",
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  {uploading ? "Uploading..." : "Send"}
                </button>
              </div>

              {/* Voice */}
              <VoiceHoldRecorder
                onSendUrl={(url: string) => {
                  if (!selectedUser) return;

                  const tempId = `temp-${Date.now()}-${Math.random()
                    .toString(16)
                    .slice(2)}`;
                  const audioMsg = `[file-audio]${url}`;

                  socketRef.current?.emit("privateMessage", {
                    senderId: userData.id,
                    receiverId: selectedUser.userId,
                    message: audioMsg,
                    tempId,
                    replyToId: replyingTo?._id || null,
                    replyText: replyingTo?.text || null,
                    replyToSelf: replyingTo?.self || false,
                  });

                  bumpChatToTop(selectedUser.userId, audioMsg);

                  setChatMessages((prev) => [
                    ...prev,
                    {
                      tempId,
                      _id: tempId,
                      text: audioMsg,
                      self: true,
                      isSeen: false,
                      isDelivered: false,
                      seenAt: null,
                      timestamp: new Date().toISOString(),
                      status: "sending",

                      replyToText: replyingTo?.text || null,
                      replyToSelf: replyingTo?.self || false,
                    },
                  ]);

                  setReplyingTo(null);
                  setTimeout(() => loadChatList(), 250);
                }}
              />

              {selectedFile && (
                <p style={{ marginTop: 8, color: "green" }}>
                  ✅ Selected: {selectedFile.name}
                </p>
              )}
            </>
          )}
        </div>

        {/* ✅ DELETE CONFIRM MODAL (Final) */}
        {deleteConfirm.open && deleteConfirm.msg && (
          <div
            onClick={closeDeleteConfirm}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 320,
                
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                Delete message?
              </h3>

              <p style={{ margin: "10px 0 14px", fontSize: 13, color: "#444" }}>
                Are you sure you want to delete this message?
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    const msgObj = deleteConfirm.msg;
                    if (!msgObj) return;
                    deleteForMe(msgObj);
                    closeDeleteConfirm();
                  }}
                >
                  Delete for me
                </button>

                {deleteConfirm.msg.self &&
                deleteConfirm.msg.timestamp &&
                isDeleteForEveryoneAllowed(deleteConfirm.msg.timestamp) ? (
                  <button
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "none",
                      background: "#ff3b30",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                    onClick={() => {
                      const msgObj = deleteConfirm.msg;
                      if (!msgObj) return;
                      deleteForEveryone(msgObj);
                      closeDeleteConfirm();
                    }}
                  >
                    Delete for everyone
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
                    Delete for everyone is available only within 15 minutes.
                  </div>
                )}

                <button
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#f7f7f7",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  onClick={closeDeleteConfirm}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}