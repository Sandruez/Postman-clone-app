"use strict";

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./page.module.css";

// Base API URL for FastAPI backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

// --- Types ---
interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

interface Environment {
  id: number;
  name: string;
  variables: Array<{ id: number; environment_id: number; key: string; value: string }>;
}

interface SavedRequest {
  id: number;
  collection_id: number;
  name: string;
  method: string;
  url: string;
  headers_json: string;
  body_type: string;
  body_raw: string;
  body_form_data_json: string;
  body_url_encoded_json: string;
  auth_type: string;
  auth_config_json: string;
}

interface Collection {
  id: number;
  name: string;
  requests: SavedRequest[];
}

interface HistoryItem {
  id: number;
  name: string;
  method: string;
  url: string;
  headers_json: string;
  body_type: string;
  body_raw: string;
  body_form_data_json: string;
  body_url_encoded_json: string;
  auth_type: string;
  auth_config_json: string;
  response_status: number;
  response_time_ms: number;
  response_size_bytes: number;
  response_headers_json: string;
  response_body: string;
  sent_at: string;
}

interface Tab {
  id: string; // unique page tab id (random or stringified request id)
  name: string;
  method: string;
  url: string;
  queryParams: KeyValue[]; // Synced with URL
  headers: KeyValue[];
  bodyType: "none" | "raw" | "form-data" | "urlencoded";
  bodyRaw: string;
  bodyRawType: "application/json" | "text/plain" | "application/xml" | "text/html";
  bodyFormData: KeyValue[];
  bodyUrlEncoded: KeyValue[];
  authType: "none" | "bearer" | "basic";
  authConfig: {
    token?: string;
    username?: string;
    password?: string;
  };
  savedId?: number; // Defined if saved in Collection DB
  isDirty?: boolean;
  isSending?: boolean;
  response?: {
    status_code: number;
    time_ms: number;
    size_bytes: number;
    headers: Array<{ key: string; value: string }>;
    body: string;
    error?: string | null;
  } | null;
}

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export default function Home() {
  // --- States ---
  const [sidebarTab, setSidebarTab] = useState<"collections" | "history" | "environments">("collections");
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [responseHeight, setResponseHeight] = useState<number>(350);
  
  // Data lists from DB
  const [collections, setCollections] = useState<Collection[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Selected IDs
  const [activeEnvId, setActiveEnvId] = useState<number | null>(null);
  
  // Tabs state
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  
  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modals visibility & data
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  
  const [showSaveRequestModal, setShowSaveRequestModal] = useState(false);
  const [saveRequestName, setSaveRequestName] = useState("");
  const [saveRequestCollectionId, setSaveRequestCollectionId] = useState<number | "">("");

  const [showCreateEnvModal, setShowCreateEnvModal] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");

  const [showEnvManagerModal, setShowEnvManagerModal] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [editingEnvVariables, setEditingEnvVariables] = useState<Array<{ key: string; value: string }>>([]);

  // Active configuration subtab
  const [activeConfigTab, setActiveConfigTab] = useState<"params" | "auth" | "headers" | "body">("params");
  
  // Active response subtab
  const [activeResponseTab, setActiveResponseTab] = useState<"body" | "headers">("body");
  
  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Layout resizing drag references
  const isDraggingSidebar = useRef(false);
  const isDraggingResponse = useRef(false);

  // --- Active Tab helper ---
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  // --- Toast handler ---
  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // --- API load functions ---
  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/collections`);
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (e) {
      console.error("Failed to fetch collections", e);
    }
  };

  const fetchEnvironments = async () => {
    try {
      const res = await fetch(`${API_BASE}/environments`);
      if (res.ok) {
        const data = await res.json();
        setEnvironments(data);
      }
    } catch (e) {
      console.error("Failed to fetch environments", e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  // Initial load
  useEffect(() => {
    fetchCollections();
    fetchEnvironments();
    fetchHistory();
  }, []);

  // Set default tab if none open
  useEffect(() => {
    if (tabs.length === 0) {
      handleCreateNewTab();
    }
  }, [tabs]);

  // --- Tab Creators & Handlers ---
  const handleCreateNewTab = (initial?: Partial<Tab>) => {
    const newId = Math.random().toString(36).substring(2, 9);
    const newTab: Tab = {
      id: newId,
      name: initial?.name || "New Request",
      method: initial?.method || "GET",
      url: initial?.url || "",
      queryParams: initial?.queryParams || [{ key: "", value: "", enabled: true }],
      headers: initial?.headers || [
        { key: "Accept", value: "*/*", enabled: true },
        { key: "User-Agent", value: "PostmanClone/1.0", enabled: true }
      ],
      bodyType: initial?.bodyType || "none",
      bodyRaw: initial?.bodyRaw || "",
      bodyRawType: initial?.bodyRawType || "application/json",
      bodyFormData: initial?.bodyFormData || [{ key: "", value: "", enabled: true }],
      bodyUrlEncoded: initial?.bodyUrlEncoded || [{ key: "", value: "", enabled: true }],
      authType: initial?.authType || "none",
      authConfig: initial?.authConfig || { token: "", username: "", password: "" },
      savedId: initial?.savedId,
      isDirty: false,
      isSending: false,
      response: initial?.response || null
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Find index
    const index = tabs.findIndex((t) => t.id === id);
    if (index === -1) return;
    
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);

    if (activeTabId === id) {
      if (nextTabs.length > 0) {
        // Set to adjacent tab
        const nextActiveIndex = Math.max(0, index - 1);
        setActiveTabId(nextTabs[nextActiveIndex].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  const updateActiveTab = (updates: Partial<Tab>) => {
    if (!activeTabId) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, ...updates, isDirty: true } : t))
    );
  };

  // --- Dynamic URL & Parameters Synchronization ---
  // 1. Sync URL typing to Params Table
  const parseUrlParams = (url: string): KeyValue[] => {
    const qIndex = url.indexOf("?");
    if (qIndex === -1) return [{ key: "", value: "", enabled: true }];
    
    const qStr = url.substring(qIndex + 1);
    if (!qStr) return [{ key: "", value: "", enabled: true }];

    const pairs = qStr.split("&");
    const parsed: KeyValue[] = [];
    
    pairs.forEach((p) => {
      const parts = p.split("=");
      const key = decodeURIComponent(parts[0] || "");
      const value = decodeURIComponent(parts[1] || "");
      if (key) {
        parsed.push({ key, value, enabled: true });
      }
    });

    // Always append an empty row for new parameter entry
    parsed.push({ key: "", value: "", enabled: true });
    return parsed.length > 0 ? parsed : [{ key: "", value: "", enabled: true }];
  };

  const handleUrlInput = (newUrl: string) => {
    if (!activeTab) return;
    
    const parsedParams = parseUrlParams(newUrl);
    
    // Check if params are actually different to prevent typing issues
    const currentParamsStripped = activeTab.queryParams.filter((p) => p.key !== "");
    const parsedParamsStripped = parsedParams.filter((p) => p.key !== "");
    
    const hasChanged = JSON.stringify(currentParamsStripped) !== JSON.stringify(parsedParamsStripped);
    
    if (hasChanged) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, url: newUrl, queryParams: parsedParams, isDirty: true }
            : t
        )
      );
    } else {
      updateActiveTab({ url: newUrl });
    }
  };

  // 2. Sync Params Table updates to URL
  const syncParamsToUrl = (params: KeyValue[]) => {
    if (!activeTab) return;
    
    const qIndex = activeTab.url.indexOf("?");
    const baseUrl = qIndex === -1 ? activeTab.url : activeTab.url.substring(0, qIndex);
    
    const activeParams = params.filter((p) => p.enabled && p.key !== "");
    
    if (activeParams.length === 0) {
      updateActiveTab({ url: baseUrl, queryParams: params });
      return;
    }

    const qStr = activeParams
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
      
    const newUrl = `${baseUrl}?${qStr}`;
    updateActiveTab({ url: newUrl, queryParams: params });
  };

  // --- Table Rows Builders ---
  const handleKeyValueChange = (
    listType: "params" | "headers" | "formdata" | "urlencoded",
    index: number,
    field: "key" | "value" | "enabled",
    val: any
  ) => {
    if (!activeTab) return;

    let targetList: KeyValue[] = [];
    if (listType === "params") targetList = [...activeTab.queryParams];
    else if (listType === "headers") targetList = [...activeTab.headers];
    else if (listType === "formdata") targetList = [...activeTab.bodyFormData];
    else if (listType === "urlencoded") targetList = [...activeTab.bodyUrlEncoded];

    // Update cell
    targetList[index] = { ...targetList[index], [field]: val };

    // Auto-append new row if typing in the last empty row
    const lastRow = targetList[targetList.length - 1];
    if (lastRow.key !== "" || lastRow.value !== "") {
      targetList.push({ key: "", value: "", enabled: true });
    }

    if (listType === "params") {
      syncParamsToUrl(targetList);
    } else {
      const fieldName = 
        listType === "headers" ? "headers" : 
        listType === "formdata" ? "bodyFormData" : "bodyUrlEncoded";
      updateActiveTab({ [fieldName]: targetList });
    }
  };

  const handleKeyValueDelete = (
    listType: "params" | "headers" | "formdata" | "urlencoded",
    index: number
  ) => {
    if (!activeTab) return;

    let targetList: KeyValue[] = [];
    if (listType === "params") targetList = [...activeTab.queryParams];
    else if (listType === "headers") targetList = [...activeTab.headers];
    else if (listType === "formdata") targetList = [...activeTab.bodyFormData];
    else if (listType === "urlencoded") targetList = [...activeTab.bodyUrlEncoded];

    if (targetList.length <= 1) {
      targetList = [{ key: "", value: "", enabled: true }];
    } else {
      targetList.splice(index, 1);
    }

    if (listType === "params") {
      syncParamsToUrl(targetList);
    } else {
      const fieldName = 
        listType === "headers" ? "headers" : 
        listType === "formdata" ? "bodyFormData" : "bodyUrlEncoded";
      updateActiveTab({ [fieldName]: targetList });
    }
  };

  // --- Send Request Proxy ---
  const handleSendRequest = async () => {
    if (!activeTab) return;
    
    updateActiveTab({ isSending: true });

    // Clean data lists
    const cleanHeaders = activeTab.headers.filter((h) => h.key !== "");
    // Ensure raw header content-type is matched
    if (activeTab.bodyType === "raw" && activeTab.bodyRaw) {
      const hasContentType = cleanHeaders.some((h) => h.key.toLowerCase() === "content-type");
      if (!hasContentType) {
        cleanHeaders.push({ key: "Content-Type", value: activeTab.bodyRawType, enabled: true });
      }
    }

    const cleanFormData = activeTab.bodyFormData.filter((f) => f.key !== "");
    const cleanUrlEncoded = activeTab.bodyUrlEncoded.filter((u) => u.key !== "");

    const payload = {
      method: activeTab.method,
      url: activeTab.url || "localhost",
      headers_json: JSON.stringify(cleanHeaders),
      body_type: activeTab.bodyType,
      body_raw: activeTab.bodyRaw,
      body_form_data_json: JSON.stringify(cleanFormData),
      body_url_encoded_json: JSON.stringify(cleanUrlEncoded),
      auth_type: activeTab.authType,
      auth_config_json: JSON.stringify(activeTab.authConfig),
      environment_id: activeEnvId
    };

    try {
      const res = await fetch(`${API_BASE}/proxy/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  isSending: false,
                  response: {
                    status_code: result.status_code,
                    time_ms: result.time_ms,
                    size_bytes: result.size_bytes,
                    headers: result.headers,
                    body: result.body,
                    error: result.error
                  }
                }
              : t
          )
        );
        addToast("Request completed", "success");
        fetchHistory(); // Refresh history panel
      } else {
        throw new Error("Failed to communicate with proxy backend");
      }
    } catch (err: any) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                isSending: false,
                response: {
                  status_code: 0,
                  time_ms: 0,
                  size_bytes: 0,
                  headers: [],
                  body: `Failed to Send Outbound Request: ${err.message}. Make sure Python backend is running.`,
                  error: "NetworkError"
                }
              }
            : t
        )
      );
      addToast(`Error sending request: ${err.message}`, "error");
    }
  };

  // --- Collection CRUD ---
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName })
      });
      if (res.ok) {
        addToast("Collection created", "success");
        setNewCollectionName("");
        setShowCreateCollectionModal(false);
        fetchCollections();
      }
    } catch (e) {
      addToast("Failed to create collection", "error");
    }
  };

  const handleDeleteCollection = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this collection and all its requests?")) return;
    try {
      const res = await fetch(`${API_BASE}/collections/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        addToast("Collection deleted", "success");
        fetchCollections();
      }
    } catch (e) {
      addToast("Failed to delete collection", "error");
    }
  };

  // --- Request Save (CRUD) ---
  const handleSaveRequestClick = () => {
    if (!activeTab) return;
    if (activeTab.savedId) {
      // Direct update
      handleUpdateRequest(activeTab.savedId);
    } else {
      // Show save modal
      setSaveRequestName(activeTab.name);
      if (collections.length > 0) {
        setSaveRequestCollectionId(collections[0].id);
      }
      setShowSaveRequestModal(true);
    }
  };

  const handleSaveRequestSubmit = async () => {
    if (!activeTab || !saveRequestName.trim() || !saveRequestCollectionId) return;

    const payload = {
      collection_id: Number(saveRequestCollectionId),
      name: saveRequestName,
      method: activeTab.method,
      url: activeTab.url,
      headers_json: JSON.stringify(activeTab.headers),
      body_type: activeTab.bodyType,
      body_raw: activeTab.bodyRaw,
      body_form_data_json: JSON.stringify(activeTab.bodyFormData),
      body_url_encoded_json: JSON.stringify(activeTab.bodyUrlEncoded),
      auth_type: activeTab.authType,
      auth_config_json: JSON.stringify(activeTab.authConfig)
    };

    try {
      const res = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId
              ? { ...t, name: saved.name, savedId: saved.id, isDirty: false }
              : t
          )
        );
        addToast("Request saved successfully", "success");
        setShowSaveRequestModal(false);
        fetchCollections();
      }
    } catch (e) {
      addToast("Failed to save request", "error");
    }
  };

  const handleUpdateRequest = async (requestId: number) => {
    if (!activeTab) return;

    const payload = {
      name: activeTab.name,
      method: activeTab.method,
      url: activeTab.url,
      headers_json: JSON.stringify(activeTab.headers),
      body_type: activeTab.bodyType,
      body_raw: activeTab.bodyRaw,
      body_form_data_json: JSON.stringify(activeTab.bodyFormData),
      body_url_encoded_json: JSON.stringify(activeTab.bodyUrlEncoded),
      auth_type: activeTab.authType,
      auth_config_json: JSON.stringify(activeTab.authConfig)
    };

    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t))
        );
        addToast("Request updated", "success");
        fetchCollections();
      }
    } catch (e) {
      addToast("Failed to update request", "error");
    }
  };

  const handleDeleteRequest = async (requestId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this saved request?")) return;
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        addToast("Request deleted", "success");
        // Clear saved ID in active tab if matches
        setTabs((prev) =>
          prev.map((t) => (t.savedId === requestId ? { ...t, savedId: undefined } : t))
        );
        fetchCollections();
      }
    } catch (e) {
      addToast("Failed to delete request", "error");
    }
  };

  const handleLoadSavedRequest = (req: SavedRequest) => {
    // Check if request is already open in a tab
    const existing = tabs.find((t) => t.savedId === req.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    // Safely parse details
    let queryParams: KeyValue[] = [{ key: "", value: "", enabled: true }];
    try {
      queryParams = parseUrlParams(req.url);
    } catch (_) {}

    let headers: KeyValue[] = [];
    try {
      headers = JSON.parse(req.headers_json);
    } catch (_) {}
    if (headers.length === 0 || headers[headers.length - 1].key !== "") {
      headers.push({ key: "", value: "", enabled: true });
    }

    let bodyFormData: KeyValue[] = [];
    try {
      bodyFormData = JSON.parse(req.body_form_data_json);
    } catch (_) {}
    if (bodyFormData.length === 0 || bodyFormData[bodyFormData.length - 1].key !== "") {
      bodyFormData.push({ key: "", value: "", enabled: true });
    }

    let bodyUrlEncoded: KeyValue[] = [];
    try {
      bodyUrlEncoded = JSON.parse(req.body_url_encoded_json);
    } catch (_) {}
    if (bodyUrlEncoded.length === 0 || bodyUrlEncoded[bodyUrlEncoded.length - 1].key !== "") {
      bodyUrlEncoded.push({ key: "", value: "", enabled: true });
    }

    let authConfig = {};
    try {
      authConfig = JSON.parse(req.auth_config_json);
    } catch (_) {}

    handleCreateNewTab({
      name: req.name,
      method: req.method,
      url: req.url,
      queryParams,
      headers,
      bodyType: req.body_type as any,
      bodyRaw: req.body_raw,
      bodyFormData,
      bodyUrlEncoded,
      authType: req.auth_type as any,
      authConfig,
      savedId: req.id,
      response: null
    });
  };

  // --- Environment CRUD ---
  const handleCreateEnvironment = async () => {
    if (!newEnvName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEnvName, variables: [] })
      });
      if (res.ok) {
        addToast("Environment created", "success");
        setNewEnvName("");
        setShowCreateEnvModal(false);
        fetchEnvironments();
      }
    } catch (e) {
      addToast("Failed to create environment", "error");
    }
  };

  const handleDeleteEnvironment = async (envId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this environment?")) return;
    try {
      const res = await fetch(`${API_BASE}/environments/${envId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        addToast("Environment deleted", "success");
        if (activeEnvId === envId) setActiveEnvId(null);
        fetchEnvironments();
      }
    } catch (e) {
      addToast("Failed to delete environment", "error");
    }
  };

  const handleEditEnvVariables = (env: Environment) => {
    setEditingEnv(env);
    const vars = env.variables.map((v) => ({ key: v.key, value: v.value }));
    vars.push({ key: "", value: "" }); // Empty row for additions
    setEditingEnvVariables(vars);
    setShowEnvManagerModal(true);
  };

  const handleEnvVariableChange = (index: number, field: "key" | "value", val: string) => {
    const list = [...editingEnvVariables];
    list[index] = { ...list[index], [field]: val };
    
    // Auto add row
    const lastRow = list[list.length - 1];
    if (lastRow.key !== "" || lastRow.value !== "") {
      list.push({ key: "", value: "" });
    }
    setEditingEnvVariables(list);
  };

  const handleEnvVariableDelete = (index: number) => {
    const list = [...editingEnvVariables];
    if (list.length <= 1) {
      setEditingEnvVariables([{ key: "", value: "" }]);
    } else {
      list.splice(index, 1);
      setEditingEnvVariables(list);
    }
  };

  const handleSaveEnvVariables = async () => {
    if (!editingEnv) return;
    
    // Clean list
    const cleanVars = editingEnvVariables.filter((v) => v.key.trim() !== "");

    try {
      const res = await fetch(`${API_BASE}/environments/${editingEnv.id}/variables`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanVars)
      });
      if (res.ok) {
        addToast("Environment variables saved", "success");
        setShowEnvManagerModal(false);
        setEditingEnv(null);
        fetchEnvironments();
      }
    } catch (e) {
      addToast("Failed to save variables", "error");
    }
  };

  // --- History integration ---
  const handleLoadHistory = (item: HistoryItem) => {
    // Parse configs safely
    let queryParams: KeyValue[] = [{ key: "", value: "", enabled: true }];
    try {
      queryParams = parseUrlParams(item.url);
    } catch (_) {}

    let headers: KeyValue[] = [];
    try {
      headers = JSON.parse(item.headers_json);
    } catch (_) {}
    if (headers.length === 0 || headers[headers.length - 1].key !== "") {
      headers.push({ key: "", value: "", enabled: true });
    }

    let bodyFormData: KeyValue[] = [];
    try {
      bodyFormData = JSON.parse(item.body_form_data_json);
    } catch (_) {}
    if (bodyFormData.length === 0 || bodyFormData[bodyFormData.length - 1].key !== "") {
      bodyFormData.push({ key: "", value: "", enabled: true });
    }

    let bodyUrlEncoded: KeyValue[] = [];
    try {
      bodyUrlEncoded = JSON.parse(item.body_url_encoded_json);
    } catch (_) {}
    if (bodyUrlEncoded.length === 0 || bodyUrlEncoded[bodyUrlEncoded.length - 1].key !== "") {
      bodyUrlEncoded.push({ key: "", value: "", enabled: true });
    }

    let authConfig = {};
    try {
      authConfig = JSON.parse(item.auth_config_json);
    } catch (_) {}

    let responseHeaders = [];
    try {
      responseHeaders = JSON.parse(item.response_headers_json);
    } catch (_) {}

    let urlPath = item.url || "";
    try {
      if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
        urlPath = new URL(urlPath).pathname;
      } else {
        const qIndex = urlPath.indexOf("?");
        urlPath = qIndex === -1 ? urlPath : urlPath.substring(0, qIndex);
      }
    } catch (_) {}

    handleCreateNewTab({
      name: `History: ${item.method} ${urlPath}`,
      method: item.method,
      url: item.url,
      queryParams,
      headers,
      bodyType: item.body_type as any,
      bodyRaw: item.body_raw,
      bodyFormData,
      bodyUrlEncoded,
      authType: item.auth_type as any,
      authConfig,
      response: {
        status_code: item.response_status,
        time_ms: item.response_time_ms,
        size_bytes: item.response_size_bytes,
        headers: responseHeaders,
        body: item.response_body
      }
    });
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to delete all history?")) return;
    try {
      const res = await fetch(`${API_BASE}/history`, { method: "DELETE" });
      if (res.ok) {
        addToast("History cleared", "success");
        setHistory([]);
      }
    } catch (e) {
      addToast("Failed to clear history", "error");
    }
  };

  const handleDeleteHistoryItem = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("History item deleted", "success");
        setHistory((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (e) {
      addToast("Failed to delete history item", "error");
    }
  };

  // --- Client Variable Resolver for Preview ---
  const getResolvedUrlPreview = (): string => {
    if (!activeTab || !activeTab.url) return "";
    
    // Find active env variables
    const activeEnv = environments.find((e) => e.id === activeEnvId);
    if (!activeEnv) return activeTab.url;

    const varMap: Record<string, string> = {};
    activeEnv.variables.forEach((v) => {
      varMap[v.key] = v.value;
    });

    return activeTab.url.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const k = key.trim();
      return varMap[k] !== undefined ? varMap[k] : match;
    });
  };

  // --- Resizing divider listeners ---
  const handleSidebarMouseDown = () => {
    isDraggingSidebar.current = true;
    document.addEventListener("mousemove", handleSidebarMouseMove);
    document.addEventListener("mouseup", handleSidebarMouseUp);
  };

  const handleSidebarMouseMove = (e: MouseEvent) => {
    if (!isDraggingSidebar.current) return;
    const newWidth = Math.max(200, Math.min(600, e.clientX - 50));
    setSidebarWidth(newWidth);
  };

  const handleSidebarMouseUp = () => {
    isDraggingSidebar.current = false;
    document.removeEventListener("mousemove", handleSidebarMouseMove);
    document.removeEventListener("mouseup", handleSidebarMouseUp);
  };

  const handleResponseMouseDown = () => {
    isDraggingResponse.current = true;
    document.addEventListener("mousemove", handleResponseMouseMove);
    document.addEventListener("mouseup", handleResponseMouseUp);
  };

  const handleResponseMouseMove = (e: MouseEvent) => {
    if (!isDraggingResponse.current) return;
    const height = Math.max(150, Math.min(800, window.innerHeight - e.clientY));
    setResponseHeight(height);
  };

  const handleResponseMouseUp = () => {
    isDraggingResponse.current = false;
    document.removeEventListener("mousemove", handleResponseMouseMove);
    document.removeEventListener("mouseup", handleResponseMouseUp);
  };

  // Safe formatting for pretty JSON responses
  const getFormattedBody = (body: string): string => {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch (_) {
      return body;
    }
  };

  // Helper color indicators for Method tags
  const getMethodColorClass = (method: string): string => {
    const m = method.toUpperCase();
    if (m === "GET") return styles.colorGet;
    if (m === "POST") return styles.colorPost;
    if (m === "PUT") return styles.colorPut;
    if (m === "DELETE") return styles.colorDelete;
    if (m === "PATCH") return styles.colorPatch;
    if (m === "OPTIONS") return styles.colorOptions;
    if (m === "HEAD") return styles.colorHead;
    return styles.colorPatch;
  };

  // Filters for Explorer search
  const filteredCollections = collections.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.requests.some((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHistory = history.filter((h) =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredEnvironments = environments.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* 1. Left Vertical Nav Bar */}
      <div className={styles.sidebar}>
        <button
          className={`${styles.sidebarTab} ${sidebarTab === "collections" ? styles.sidebarTabActive : ""}`}
          onClick={() => { setSidebarTab("collections"); setSearchQuery(""); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span className={styles.sidebarTabLabel}>Collections</span>
        </button>
        <button
          className={`${styles.sidebarTab} ${sidebarTab === "history" ? styles.sidebarTabActive : ""}`}
          onClick={() => { setSidebarTab("history"); setSearchQuery(""); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span className={styles.sidebarTabLabel}>History</span>
        </button>
        <button
          className={`${styles.sidebarTab} ${sidebarTab === "environments" ? styles.sidebarTabActive : ""}`}
          onClick={() => { setSidebarTab("environments"); setSearchQuery(""); }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
          <span className={styles.sidebarTabLabel}>Environments</span>
        </button>
      </div>

      {/* 2. Resizable Explorer Side Drawer */}
      <div className={styles.explorer} style={{ width: sidebarWidth }}>
        <div className={styles.explorerHeader}>
          <span className={styles.explorerTitle}>
            {sidebarTab.toUpperCase()}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Local Workspace
          </span>
        </div>
        
        {/* Search */}
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder={`Filter ${sidebarTab}...`}
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Action Button */}
        {sidebarTab === "collections" && (
          <button className={styles.btnNew} onClick={() => setShowCreateCollectionModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Collection
          </button>
        )}
        {sidebarTab === "environments" && (
          <button className={styles.btnNew} onClick={() => setShowCreateEnvModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Environment
          </button>
        )}
        {sidebarTab === "history" && history.length > 0 && (
          <button className={styles.btnNew} onClick={handleClearHistory}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Clear History
          </button>
        )}

        <div className={styles.explorerContent}>
          {/* A. Collections Tree */}
          {sidebarTab === "collections" && (
            <div>
              {filteredCollections.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  No Collections found.
                </div>
              ) : (
                filteredCollections.map((col) => (
                  <div key={col.id} className={styles.listGroup}>
                    <div className={styles.listGroupHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--color-orange)" }}>
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span style={{ fontWeight: 500 }}>{col.name}</span>
                      </div>
                      <button className={styles.btnAction} onClick={(e) => handleDeleteCollection(col.id, e)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                        </svg>
                      </button>
                    </div>
                    
                    <div className={styles.listGroupItems}>
                      {col.requests.map((req) => (
                        <div
                          key={req.id}
                          className={`${styles.listItem} ${activeTab?.savedId === req.id ? styles.listItemActive : ""}`}
                          onClick={() => handleLoadSavedRequest(req)}
                        >
                          <div style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
                            <span className={`${styles.methodBadge} ${getMethodColorClass(req.method)}`}>
                              {req.method}
                            </span>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {req.name}
                            </span>
                          </div>
                          <button className={styles.btnAction} onClick={(e) => handleDeleteRequest(req.id, e)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      ))}
                      {col.requests.length === 0 && (
                        <div style={{ padding: "6px 12px", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                          Empty collection. Save requests here!
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* B. History Items */}
          {sidebarTab === "history" && (
            <div>
              {filteredHistory.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  No request history yet.
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className={styles.listItem}
                    onClick={() => handleLoadHistory(item)}
                    style={{ fontSize: "12px" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", overflow: "hidden", flex: 1 }}>
                      <span className={`${styles.methodBadge} ${getMethodColorClass(item.method)}`}>
                        {item.method}
                      </span>
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px"
                        }}
                      >
                        {item.url}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          color: item.response_status && item.response_status < 400 ? "var(--color-get)" : "var(--color-delete)"
                        }}
                      >
                        {item.response_status || "ERR"}
                      </span>
                      <button className={styles.btnAction} onClick={(e) => handleDeleteHistoryItem(item.id, e)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* C. Environments */}
          {sidebarTab === "environments" && (
            <div>
              {filteredEnvironments.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                  No Environments found.
                </div>
              ) : (
                filteredEnvironments.map((env) => (
                  <div
                    key={env.id}
                    className={`${styles.listItem} ${activeEnvId === env.id ? styles.listItemActive : ""}`}
                    onClick={() => handleEditEnvVariables(env)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: activeEnvId === env.id ? "var(--color-orange)" : "var(--text-secondary)" }}>
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4a2 2 0 0 0-1 1.73v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"></path>
                      </svg>
                      <span style={{ fontWeight: 500 }}>{env.name}</span>
                    </div>
                    
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className={styles.btnAction}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveEnvId(activeEnvId === env.id ? null : env.id);
                          addToast(activeEnvId === env.id ? "Environment deselected" : `Selected ${env.name}`);
                        }}
                        title="Set Active Environment"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill={activeEnvId === env.id ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                          style={{ color: activeEnvId === env.id ? "var(--color-orange)" : "inherit" }}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                      </button>
                      <button className={styles.btnAction} onClick={(e) => handleDeleteEnvironment(env.id, e)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Explorer panel resizer handle */}
      <div className={styles.resizerH} onMouseDown={handleSidebarMouseDown} />

      {/* 3. Central Workspace Container */}
      <div className={styles.workspace}>
        {/* Request Tabs Bar */}
        <div className={styles.tabsBar}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`${styles.tab} ${activeTabId === tab.id ? styles.tabActive : ""}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className={`${styles.tabMethod} ${getMethodColorClass(tab.method)}`}>
                {tab.method}
              </span>
              <span className={styles.tabName}>
                {tab.name}
                {tab.isDirty && " •"}
              </span>
              <button className={styles.tabClose} onClick={(e) => handleCloseTab(tab.id, e)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          ))}
          <div className={styles.tabAdd} onClick={() => handleCreateNewTab()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
        </div>

        {activeTab ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Request Builder Settings & Input */}
            <div className={styles.requestBuilder}>
              {/* Env Selector Top Row */}
              <div className={styles.envSelectorRow}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Environment:</span>
                <select
                  className={styles.envSelect}
                  value={activeEnvId || ""}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    setActiveEnvId(id);
                    if (id) {
                      const env = environments.find((envItem) => envItem.id === id);
                      if (env) addToast(`Switched to environment: ${env.name}`);
                    } else {
                      addToast("Switched to No Environment");
                    }
                  }}
                >
                  <option value="">No Environment</option>
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* URL bar Row */}
              <div className={styles.urlRow}>
                <select
                  className={styles.methodSelect}
                  value={activeTab.method}
                  onChange={(e) => updateActiveTab({ method: e.target.value })}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                  <option value="OPTIONS">OPTIONS</option>
                  <option value="HEAD">HEAD</option>
                </select>

                <div className={styles.urlInputContainer}>
                  <input
                    type="text"
                    className={styles.urlInput}
                    placeholder="Enter request URL (e.g. {{baseUrl}}/get or https://httpbin.org/get)"
                    value={activeTab.url}
                    onChange={(e) => handleUrlInput(e.target.value)}
                  />
                </div>

                <button
                  className={styles.btnSend}
                  onClick={handleSendRequest}
                  disabled={activeTab.isSending}
                >
                  {activeTab.isSending ? "Sending..." : "Send"}
                </button>
                <button className={styles.btnSave} onClick={handleSaveRequestClick}>
                  {activeTab.savedId ? "Update" : "Save"}
                </button>
              </div>

              {/* Resolved URL Preview for UX */}
              {activeTab.url.includes("{{") && (
                <div style={{ marginTop: "-10px", marginBottom: "15px", fontSize: "11px", color: "var(--text-secondary)" }}>
                  <span style={{ fontWeight: 500 }}>Preview:</span>{" "}
                  <code style={{ color: "var(--color-orange)", fontFamily: "var(--font-mono)" }}>
                    {getResolvedUrlPreview() || "(no URL)"}
                  </code>
                </div>
              )}

              {/* Request Parameters/Headers/Body Configuration Tabs */}
              <div className={styles.configTabs}>
                <span
                  className={`${styles.configTab} ${activeConfigTab === "params" ? styles.configTabActive : ""}`}
                  onClick={() => setActiveConfigTab("params")}
                >
                  Params ({activeTab.queryParams.filter((p) => p.key !== "").length})
                </span>
                <span
                  className={`${styles.configTab} ${activeConfigTab === "auth" ? styles.configTabActive : ""}`}
                  onClick={() => setActiveConfigTab("auth")}
                >
                  Authorization
                </span>
                <span
                  className={`${styles.configTab} ${activeConfigTab === "headers" ? styles.configTabActive : ""}`}
                  onClick={() => setActiveConfigTab("headers")}
                >
                  Headers ({activeTab.headers.filter((h) => h.key !== "").length})
                </span>
                <span
                  className={`${styles.configTab} ${activeConfigTab === "body" ? styles.configTabActive : ""}`}
                  onClick={() => setActiveConfigTab("body")}
                >
                  Body {activeTab.bodyType !== "none" && `(${activeTab.bodyType})`}
                </span>
              </div>

              {/* Config Contents */}
              <div className={styles.configContent}>
                {/* A. Query Params */}
                {activeConfigTab === "params" && (
                  <table className={styles.kvTable}>
                    <thead>
                      <tr>
                        <th className={styles.checkboxCell}></th>
                        <th>Key</th>
                        <th>Value</th>
                        <th className={styles.actionCell}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab.queryParams.map((param, index) => (
                        <tr key={index}>
                          <td className={styles.checkboxCell}>
                            <input
                              type="checkbox"
                              checked={param.enabled}
                              onChange={(e) =>
                                handleKeyValueChange("params", index, "enabled", e.target.checked)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.kvInput}
                              placeholder="Parameter Key"
                              value={param.key}
                              onChange={(e) =>
                                handleKeyValueChange("params", index, "key", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.kvInput}
                              placeholder="Parameter Value"
                              value={param.value}
                              onChange={(e) =>
                                handleKeyValueChange("params", index, "value", e.target.value)
                              }
                            />
                          </td>
                          <td className={styles.actionCell}>
                            {index < activeTab.queryParams.length - 1 && (
                              <button
                                className={styles.btnAction}
                                onClick={() => handleKeyValueDelete("params", index)}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* B. Authorization */}
                {activeConfigTab === "auth" && (
                  <div className={styles.authContainer}>
                    <div className={styles.formGroup}>
                      <label>Auth Type</label>
                      <select
                        className={styles.formInput}
                        value={activeTab.authType}
                        onChange={(e) => updateActiveTab({ authType: e.target.value as any })}
                      >
                        <option value="none">No Auth</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                      </select>
                    </div>

                    {activeTab.authType === "bearer" && (
                      <div className={styles.formGroup}>
                        <label>Token</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          placeholder="Bearer Token (supports {{variable}})"
                          value={activeTab.authConfig.token || ""}
                          onChange={(e) =>
                            updateActiveTab({
                              authConfig: { ...activeTab.authConfig, token: e.target.value }
                            })
                          }
                        />
                      </div>
                    )}

                    {activeTab.authType === "basic" && (
                      <>
                        <div className={styles.formGroup}>
                          <label>Username</label>
                          <input
                            type="text"
                            className={styles.formInput}
                            placeholder="Username"
                            value={activeTab.authConfig.username || ""}
                            onChange={(e) =>
                              updateActiveTab({
                                authConfig: { ...activeTab.authConfig, username: e.target.value }
                              })
                            }
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Password</label>
                          <input
                            type="password"
                            className={styles.formInput}
                            placeholder="Password"
                            value={activeTab.authConfig.password || ""}
                            onChange={(e) =>
                              updateActiveTab({
                                authConfig: { ...activeTab.authConfig, password: e.target.value }
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* C. Headers */}
                {activeConfigTab === "headers" && (
                  <table className={styles.kvTable}>
                    <thead>
                      <tr>
                        <th className={styles.checkboxCell}></th>
                        <th>Header Key</th>
                        <th>Header Value</th>
                        <th className={styles.actionCell}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab.headers.map((header, index) => (
                        <tr key={index}>
                          <td className={styles.checkboxCell}>
                            <input
                              type="checkbox"
                              checked={header.enabled}
                              onChange={(e) =>
                                handleKeyValueChange("headers", index, "enabled", e.target.checked)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.kvInput}
                              placeholder="Header Name"
                              value={header.key}
                              onChange={(e) =>
                                handleKeyValueChange("headers", index, "key", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className={styles.kvInput}
                              placeholder="Header Value"
                              value={header.value}
                              onChange={(e) =>
                                handleKeyValueChange("headers", index, "value", e.target.value)
                              }
                            />
                          </td>
                          <td className={styles.actionCell}>
                            {index < activeTab.headers.length - 1 && (
                              <button
                                className={styles.btnAction}
                                onClick={() => handleKeyValueDelete("headers", index)}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* D. Body Editor */}
                {activeConfigTab === "body" && (
                  <div>
                    <div className={styles.bodyTypeSelector}>
                      <label className={styles.bodyTypeRadio}>
                        <input
                          type="radio"
                          name="bodyType"
                          checked={activeTab.bodyType === "none"}
                          onChange={() => updateActiveTab({ bodyType: "none" })}
                        />
                        None
                      </label>
                      <label className={styles.bodyTypeRadio}>
                        <input
                          type="radio"
                          name="bodyType"
                          checked={activeTab.bodyType === "raw"}
                          onChange={() => updateActiveTab({ bodyType: "raw" })}
                        />
                        Raw (Text/JSON)
                      </label>
                      <label className={styles.bodyTypeRadio}>
                        <input
                          type="radio"
                          name="bodyType"
                          checked={activeTab.bodyType === "form-data"}
                          onChange={() => updateActiveTab({ bodyType: "form-data" })}
                        />
                        Form Data
                      </label>
                      <label className={styles.bodyTypeRadio}>
                        <input
                          type="radio"
                          name="bodyType"
                          checked={activeTab.bodyType === "urlencoded"}
                          onChange={() => updateActiveTab({ bodyType: "urlencoded" })}
                        />
                        x-www-form-urlencoded
                      </label>
                    </div>

                    {/* Raw Text Body */}
                    {activeTab.bodyType === "raw" && (
                      <div className={styles.rawEditorContainer}>
                        <div className={styles.rawEditorHeader}>
                          <select
                            className={styles.envSelect}
                            style={{ margin: 0 }}
                            value={activeTab.bodyRawType}
                            onChange={(e) => updateActiveTab({ bodyRawType: e.target.value as any })}
                          >
                            <option value="application/json">JSON</option>
                            <option value="text/plain">Text</option>
                            <option value="application/xml">XML</option>
                            <option value="text/html">HTML</option>
                          </select>
                        </div>
                        <textarea
                          className={styles.rawEditor}
                          placeholder="Raw content body here..."
                          value={activeTab.bodyRaw}
                          onChange={(e) => updateActiveTab({ bodyRaw: e.target.value })}
                        />
                      </div>
                    )}

                    {/* Form Data Grid */}
                    {activeTab.bodyType === "form-data" && (
                      <table className={styles.kvTable}>
                        <thead>
                          <tr>
                            <th className={styles.checkboxCell}></th>
                            <th>Field Key</th>
                            <th>Field Value</th>
                            <th className={styles.actionCell}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTab.bodyFormData.map((fd, index) => (
                            <tr key={index}>
                              <td className={styles.checkboxCell}>
                                <input
                                  type="checkbox"
                                  checked={fd.enabled}
                                  onChange={(e) =>
                                    handleKeyValueChange("formdata", index, "enabled", e.target.checked)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={styles.kvInput}
                                  placeholder="Field Key"
                                  value={fd.key}
                                  onChange={(e) =>
                                    handleKeyValueChange("formdata", index, "key", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={styles.kvInput}
                                  placeholder="Field Value"
                                  value={fd.value}
                                  onChange={(e) =>
                                    handleKeyValueChange("formdata", index, "value", e.target.value)
                                  }
                                />
                              </td>
                              <td className={styles.actionCell}>
                                {index < activeTab.bodyFormData.length - 1 && (
                                  <button
                                    className={styles.btnAction}
                                    onClick={() => handleKeyValueDelete("formdata", index)}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18"></line>
                                      <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* URL Encoded Grid */}
                    {activeTab.bodyType === "urlencoded" && (
                      <table className={styles.kvTable}>
                        <thead>
                          <tr>
                            <th className={styles.checkboxCell}></th>
                            <th>Field Key</th>
                            <th>Field Value</th>
                            <th className={styles.actionCell}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTab.bodyUrlEncoded.map((ue, index) => (
                            <tr key={index}>
                              <td className={styles.checkboxCell}>
                                <input
                                  type="checkbox"
                                  checked={ue.enabled}
                                  onChange={(e) =>
                                    handleKeyValueChange("urlencoded", index, "enabled", e.target.checked)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={styles.kvInput}
                                  placeholder="Field Key"
                                  value={ue.key}
                                  onChange={(e) =>
                                    handleKeyValueChange("urlencoded", index, "key", e.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={styles.kvInput}
                                  placeholder="Field Value"
                                  value={ue.value}
                                  onChange={(e) =>
                                    handleKeyValueChange("urlencoded", index, "value", e.target.value)
                                  }
                                />
                              </td>
                              <td className={styles.actionCell}>
                                {index < activeTab.bodyUrlEncoded.length - 1 && (
                                  <button
                                    className={styles.btnAction}
                                    onClick={() => handleKeyValueDelete("urlencoded", index)}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18"></line>
                                      <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Config-to-Response Pane Resizer */}
            <div className={styles.resizerV} onMouseDown={handleResponseMouseDown} />

            {/* 4. Response Viewer Pane */}
            <div className={styles.responseArea} style={{ height: responseHeight }}>
              {activeTab.response ? (
                <div className={styles.responseContent}>
                  <div className={styles.responseHeader}>
                    <span className={styles.responseTitle}>Response</span>
                    
                    <div className={styles.responseMeta}>
                      {activeTab.response.status_code > 0 ? (
                        <>
                          {/* Status Badge */}
                          <span
                            className={`${styles.badge} ${
                              activeTab.response.status_code >= 200 && activeTab.response.status_code < 300
                                ? styles.badgeGreen
                                : activeTab.response.status_code >= 400
                                ? styles.badgeRed
                                : styles.badgeYellow
                            }`}
                          >
                            Status: {activeTab.response.status_code}
                          </span>
                          
                          {/* Time Badge */}
                          <span className={`${styles.badge} ${styles.badgeGray}`}>
                            Time: {activeTab.response.time_ms} ms
                          </span>
                          
                          {/* Size Badge */}
                          <span className={`${styles.badge} ${styles.badgeGray}`}>
                            Size: {(activeTab.response.size_bytes / 1024).toFixed(2)} KB
                          </span>
                        </>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeRed}`}>
                          CONNECTION ERROR
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.responseTabs}>
                    <span
                      className={`${styles.responseTab} ${activeResponseTab === "body" ? styles.responseTabActive : ""}`}
                      onClick={() => setActiveResponseTab("body")}
                    >
                      Response Body
                    </span>
                    <span
                      className={`${styles.responseTab} ${activeResponseTab === "headers" ? styles.responseTabActive : ""}`}
                      onClick={() => setActiveResponseTab("headers")}
                    >
                      Headers ({activeTab.response.headers.length})
                    </span>
                  </div>

                  <div className={styles.responseBodyView}>
                    {activeResponseTab === "body" && (
                      <pre className={styles.prettyPrint}>
                        <code style={{ color: "#21d2b4" }}>
                          {getFormattedBody(activeTab.response.body)}
                        </code>
                      </pre>
                    )}

                    {activeResponseTab === "headers" && (
                      <table className={styles.kvTable}>
                        <thead>
                          <tr>
                            <th>Header Key</th>
                            <th>Header Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTab.response.headers.map((h, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{h.key}</td>
                              <td style={{ fontFamily: "var(--font-mono)" }}>{h.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.placeholderView}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                  <span>Click Send to view the response execution results.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.placeholderView} style={{ flex: 1 }}>
            <h3>No Request Tab Open</h3>
            <button className={styles.btnSend} style={{ width: "auto", marginTop: "10px" }} onClick={() => handleCreateNewTab()}>
              Create a Tab
            </button>
          </div>
        )}
      </div>

      {/* --- Toasts Alerts Box --- */}
      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast}>
            <span>{t.message}</span>
            <button style={{ background: "transparent", border: "none", color: "white", cursor: "pointer" }} onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}>
              x
            </button>
          </div>
        ))}
      </div>

      {/* --- MODALS --- */}

      {/* 1. Create Collection Modal */}
      {showCreateCollectionModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Create New Collection</span>
              <button className={styles.tabClose} onClick={() => setShowCreateCollectionModal(false)}>x</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Collection Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. My REST APIs"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                  autoFocus
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSave} onClick={() => setShowCreateCollectionModal(false)}>Cancel</button>
              <button className={styles.btnSend} onClick={handleCreateCollection}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Save Request Modal */}
      {showSaveRequestModal && activeTab && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Save Request to Collection</span>
              <button className={styles.tabClose} onClick={() => setShowSaveRequestModal(false)}>x</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Request Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Fetch Active Users"
                  value={saveRequestName}
                  onChange={(e) => setSaveRequestName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label>Select Collection</label>
                {collections.length === 0 ? (
                  <div style={{ color: "var(--color-delete)", fontSize: "12px" }}>
                    No collections exist. Create a collection first!
                  </div>
                ) : (
                  <select
                    className={styles.formInput}
                    value={saveRequestCollectionId}
                    onChange={(e) => setSaveRequestCollectionId(Number(e.target.value))}
                  >
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSave} onClick={() => setShowSaveRequestModal(false)}>Cancel</button>
              <button
                className={styles.btnSend}
                disabled={collections.length === 0 || !saveRequestName.trim()}
                onClick={handleSaveRequestSubmit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Create Environment Modal */}
      {showCreateEnvModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Create New Environment</span>
              <button className={styles.tabClose} onClick={() => setShowCreateEnvModal(false)}>x</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Environment Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Production or Local dev"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateEnvironment()}
                  autoFocus
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSave} onClick={() => setShowCreateEnvModal(false)}>Cancel</button>
              <button className={styles.btnSend} onClick={handleCreateEnvironment}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Edit Environment Variables Modal */}
      {showEnvManagerModal && editingEnv && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ width: "550px" }}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Manage Variables: {editingEnv.name}</span>
              <button className={styles.tabClose} onClick={() => { setShowEnvManagerModal(false); setEditingEnv(null); }}>x</button>
            </div>
            <div className={styles.modalBody} style={{ maxHeight: "350px", overflowY: "auto" }}>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                Reference in requests using: <code>{"{{variable_key}}"}</code>
              </span>
              <table className={styles.kvTable}>
                <thead>
                  <tr>
                    <th>Variable Key</th>
                    <th>Variable Value</th>
                    <th className={styles.actionCell}></th>
                  </tr>
                </thead>
                <tbody>
                  {editingEnvVariables.map((v, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="text"
                          className={styles.kvInput}
                          placeholder="key"
                          value={v.key}
                          onChange={(e) => handleEnvVariableChange(i, "key", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className={styles.kvInput}
                          placeholder="value"
                          value={v.value}
                          onChange={(e) => handleEnvVariableChange(i, "value", e.target.value)}
                        />
                      </td>
                      <td className={styles.actionCell}>
                        {i < editingEnvVariables.length - 1 && (
                          <button className={styles.btnAction} onClick={() => handleEnvVariableDelete(i)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSave} onClick={() => { setShowEnvManagerModal(false); setEditingEnv(null); }}>Cancel</button>
              <button className={styles.btnSend} onClick={handleSaveEnvVariables}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
