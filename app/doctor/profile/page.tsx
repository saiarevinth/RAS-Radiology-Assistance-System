'use client';

import { useEffect, useState } from "react"
import { useAuth } from "@/components/AuthContext"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, AlertCircle } from "lucide-react"

// Returns true if patient is high priority (age >= 65 or critical keywords)
function isHighPriority(patient: any): boolean {
  // Try both assignedPatients and their latest intake if present
  const age = parseInt(patient.age || (patient.intake && patient.intake.age) || "0", 10)
  if (age >= 65) return true
  const keywords = ["critical", "stroke", "severe", "emergency", "ICU", "urgent", "unstable", "life-threatening"]
  const fields = [
    (patient.chief_complaint || (patient.intake && patient.intake.chief_complaint) || "").toLowerCase(),
    (patient.previous_condition || (patient.intake && patient.intake.previous_condition) || "").toLowerCase(),
  ]
  return keywords.some(word => fields.some(f => f.includes(word)))
}

// Returns a string reason for priority
function getPriorityReason(patient: any): string {
  const age = parseInt(patient.age || (patient.intake && patient.intake.age) || "0", 10)
  if (age >= 65) return `Elderly (Age ${age})`
  const fields = [
    { label: "Chief Complaint", value: patient.chief_complaint || (patient.intake && patient.intake.chief_complaint) || "" },
    { label: "Condition", value: patient.previous_condition || (patient.intake && patient.intake.previous_condition) || "" },
  ]
  const keywords = ["critical", "stroke", "severe", "emergency", "ICU", "urgent", "unstable", "life-threatening"]
  for (const { label, value } of fields) {
    for (const word of keywords) {
      if (value.toLowerCase().includes(word)) {
        return `${label}: ${word.charAt(0).toUpperCase() + word.slice(1)}`
      }
    }
  }
  return "High risk"
}

function isHighPriorityFlag(val: unknown): boolean {
  return val === true || val === "true" || val === 1 || val === "1";
}

export default function DoctorProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  interface Patient {
    id: string | number;
    full_name: string;
    patient_id: string | number;
    high_priority?: boolean;
    age?: number | string;
    chief_complaint?: string;
    previous_condition?: string;
    intake?: any;
  }

  const [assignedPatients, setAssignedPatients] = useState<Patient[]>([])
  const [attendedPatients, setAttendedPatients] = useState<Patient[]>([])
  const [error, setError] = useState<string | null>(null)
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

  // Get doctor email from query param (for deep linking)
  const [doctorEmail, setDoctorEmail] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const email = params.get('email')
      setDoctorEmail(email)
    }
  }, [])

  useEffect(() => {
    if (!loading && (!user || user.role !== "doctor")) {
      router.replace("/doctor/login?redirect=/doctor/profile")
    }
  }, [loading, user, router])

  // Helper to fetch attended patients
  const fetchAttendedPatients = () => {
    if (user && user.role === "doctor") {
      const doctorId = user?.id;
      const attendedUrl = doctorId
        ? `${BACKEND_URL}/api/doctor/${doctorId}/attended-patients`
        : null;
      if (attendedUrl) {
        fetch(attendedUrl, { credentials: 'include' })
          .then(res => res.json())
          .then(data => setAttendedPatients(data.attended_patients || []))
          .catch(() => setError("Failed to load attended patients"));
      }
    }
  }

  useEffect(() => {
    if (user && user.role === "doctor") {
      const doctorId = user?.id;
      const assignedUrl = doctorId
        ? `${BACKEND_URL}/api/doctor/${doctorId}/assigned-patients`
        : null;
      if (assignedUrl) {
        fetch(assignedUrl, { credentials: 'include' })
          .then(res => res.json())
          .then(data => setAssignedPatients(data.assigned_patients || []))
          .catch(() => setError("Failed to load assigned patients"));
      }
      fetchAttendedPatients();
    }
  }, [user, doctorEmail])

  // Listen for attended patients refresh event (triggered by main page)
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "ras_attended_patients_refresh") {
        fetchAttendedPatients();
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== "doctor") return null

  // --- Search and filter state ---
  const [searchIdInput, setSearchIdInput] = useState("");
  const [searchNameInput, setSearchNameInput] = useState("");
  const [priorityFilterInput, setPriorityFilterInput] = useState<string>("all");
  const [ageFilterInput, setAgeFilterInput] = useState<string>("");
  const [attendedFilterInput, setAttendedFilterInput] = useState<string>("all");
  // Actual filter state (applied only on button click)
  const [searchId, setSearchId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [ageFilter, setAgeFilter] = useState<string>("");
  const [attendedFilter, setAttendedFilter] = useState<string>("all");

  // --- Filtered patients ---
  const getFilteredPatients = (patients: Patient[], highPrioritySection: boolean) => {
    let filtered = patients.filter((p) => {
      // Section filter
      const isHigh = isHighPriorityFlag(p.high_priority) || (p.high_priority === undefined && isHighPriority(p));
      if (highPrioritySection && !isHigh) return false;
      if (!highPrioritySection && isHigh) return false;
      // Search by ID
      if (searchId && !(p.patient_id + "").toLowerCase().includes(searchId.toLowerCase())) return false;
      // Search by Name
      if (searchName && !(p.full_name || "").toLowerCase().includes(searchName.toLowerCase())) return false;
      // Priority filter
      if (priorityFilter === "high" && !isHigh) return false;
      if (priorityFilter === "normal" && isHigh) return false;
      // Age filter
      const age = parseInt((p.age || (p.intake && p.intake.age) || "0") + "", 10);
      if (ageFilter === ">=65" && age < 65) return false;
      if (ageFilter === "<65" && age >= 65) return false;
      // Attended filter
      const isAttended = attendedPatients.some((a) => a.id === p.id);
      if (attendedFilter === "attended" && !isAttended) return false;
      if (attendedFilter === "not_attended" && isAttended) return false;
      return true;
    });
    return filtered;
  };

  // Handler for Search/Filter button
  const handleApplyFilters = () => {
    setSearchId(searchIdInput);
    setSearchName(searchNameInput);
    setPriorityFilter(priorityFilterInput);
    setAgeFilter(ageFilterInput);
    setAttendedFilter(attendedFilterInput);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Doctor Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls */}
            <div className="mb-6 flex flex-wrap gap-3 items-end">
              <div>
                <Label htmlFor="search-id">Patient ID</Label>
                <Input id="search-id" value={searchIdInput} onChange={e => setSearchIdInput(e.target.value)} placeholder="Search by ID" />
              </div>
              <div>
                <Label htmlFor="search-name">Name</Label>
                <Input id="search-name" value={searchNameInput} onChange={e => setSearchNameInput(e.target.value)} placeholder="Search by Name" />
              </div>
              <div>
                <Label htmlFor="priority-filter">Priority</Label>
                <select id="priority-filter" className="block border rounded px-2 py-1" value={priorityFilterInput} onChange={e => setPriorityFilterInput(e.target.value)}>
                  <option value="all">All</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <div>
                <Label htmlFor="age-filter">Age</Label>
                <select id="age-filter" className="block border rounded px-2 py-1" value={ageFilterInput} onChange={e => setAgeFilterInput(e.target.value)}>
                  <option value="">All</option>
                  <option value=">=65">65 and above</option>
                  <option value="<65">Below 65</option>
                </select>
              </div>
              <div>
                <Label htmlFor="attended-filter">Attended</Label>
                <select id="attended-filter" className="block border rounded px-2 py-1" value={attendedFilterInput} onChange={e => setAttendedFilterInput(e.target.value)}>
                  <option value="all">All</option>
                  <option value="attended">Attended</option>
                  <option value="not_attended">Not Attended</option>
                </select>
              </div>
              <div>
                <button onClick={handleApplyFilters} className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition">Search / Filter</button>
              </div>
            </div>
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-lg">{user.full_name}</span>
                <span className="ml-2 text-gray-500">({user.specialty || user.department})</span>
              </div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </div>

            <div className="mb-8">
              {/* High Priority Patients Section */}
              <div>
                <h3 className="font-semibold text-red-700 mb-2">High Priority Patients</h3>
                <ul className="space-y-2">
                  {getFilteredPatients(assignedPatients, true).length === 0 ? (
                    <li className="text-gray-600">No high priority patients.</li>
                  ) : (
                    getFilteredPatients(assignedPatients, true).map((p) => {
  const isAttended = attendedPatients.some((a) => a.id === p.id)
  return (
    <li key={p.id} className="flex items-center border-l-4 border-red-700 bg-red-50 px-2 py-1 rounded">
      <span className="text-xs font-bold text-red-700 mr-2">HIGH PRIORITY</span>
      <span className="font-medium">{p.full_name}</span> (ID: {p.patient_id})
      <span className="ml-2 text-xs text-red-600">{getPriorityReason(p)}</span>
      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:isHighPriorityFlag(p.high_priority)?"#fee2e2":"#e0e7ff",color:isHighPriorityFlag(p.high_priority)?"#b91c1c":"#1e40af"}}>
        {isHighPriorityFlag(p.high_priority) ? "High" : "Normal"} Priority
      </span>
      <input
        type="checkbox"
        checked={isAttended}
        disabled={isAttended}
        className="ml-2"
        onChange={() => {}}
      />
      {isAttended ? (
        <>
          <span className="ml-2 text-green-600 text-xs">Attended</span>
          <button
            className="ml-2 text-blue-600 underline text-xs"
            onClick={async () => {
              try {
                const resp = await fetch(`${BACKEND_URL}/api/doctor/${user.id}/undo-attend-patient`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ patient_id: p.id }),
                })
                if (resp.ok) {
                  fetchAttendedPatients()
                  if (typeof window !== "undefined") {
                    localStorage.setItem("ras_attended_patients_refresh", Date.now().toString())
                  }
                } else {
                  setError("Failed to undo attend for patient")
                }
              } catch {
                setError("Failed to undo attend for patient")
              }
            }}
          >Undo</button>
        </>
      ) : (
        <button
          className="ml-2 text-blue-600 underline text-xs"
          onClick={async () => {
            try {
              const resp = await fetch(`${BACKEND_URL}/api/doctor/${user.id}/attend-patient`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ patient_id: p.id }),
              })
              if (resp.ok) {
                fetchAttendedPatients()
                if (typeof window !== "undefined") {
                  localStorage.setItem("ras_attended_patients_refresh", Date.now().toString())
                }
              } else {
                setError("Failed to mark patient as attended")
              }
            } catch {
              setError("Failed to mark patient as attended")
            }
          }}
        >Mark as Attended</button>
      )}
    </li>
  )
})
                  )}
                </ul>
              </div>

              {/* Assigned Patients Section */}
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Assigned Patients</h3>
                <ul className="space-y-2">
                  {getFilteredPatients(assignedPatients, false).length === 0 ? (
                    <li className="text-gray-600">No normal priority patients.</li>
                  ) : (
                    getFilteredPatients(assignedPatients, false).map((p) => {
                      const isAttended = attendedPatients.some((a) => a.id === p.id)
                      return (
                        <li key={p.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isAttended}
                            disabled={isAttended}
                            onChange={() => {}}
                          />
                          <span className="font-medium">{p.full_name}</span> (ID: {p.patient_id})
                          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full" style={{background:isHighPriorityFlag(p.high_priority)?"#fee2e2":"#e0e7ff",color:isHighPriorityFlag(p.high_priority)?"#b91c1c":"#1e40af"}}>
                            {isHighPriorityFlag(p.high_priority) ? "High" : "Normal"} Priority
                          </span>
                          {isAttended ? (
                            <>
                              <span className="ml-2 text-green-600 text-xs">Attended</span>
                              <button
                                className="ml-2 text-blue-600 underline text-xs"
                                onClick={async () => {
                                  try {
                                    const resp = await fetch(`${BACKEND_URL}/api/doctor/${user.id}/undo-attend-patient`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      credentials: "include",
                                      body: JSON.stringify({ patient_id: p.id }),
                                    })
                                    if (resp.ok) {
                                      fetchAttendedPatients()
                                      if (typeof window !== "undefined") {
                                        localStorage.setItem("ras_attended_patients_refresh", Date.now().toString())
                                      }
                                    } else {
                                      setError("Failed to undo attend for patient")
                                    }
                                  } catch {
                                    setError("Failed to undo attend for patient")
                                  }
                                }}
                              >Undo</button>
                            </>
                          ) : (
                            <button
                              className="ml-2 text-blue-600 underline text-xs"
                              onClick={async () => {
                                try {
                                  const resp = await fetch(`${BACKEND_URL}/api/doctor/${user.id}/attend-patient`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ patient_id: p.id }),
                                  })
                                  if (resp.ok) {
                                    fetchAttendedPatients()
                                    if (typeof window !== "undefined") {
                                      localStorage.setItem("ras_attended_patients_refresh", Date.now().toString())
                                    }
                                  } else {
                                    setError("Failed to mark patient as attended")
                                  }
                                } catch {
                                  setError("Failed to mark patient as attended")
                                }
                              }}
                            >Mark as Attended</button>
                          )}
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Attended Patients</h3>
              {attendedPatients.length === 0 ? (
                <p className="text-gray-600">No attended patients.</p>
              ) : (
                <ul className="list-disc ml-6">
                  {attendedPatients.map((p: any) => (
  <li key={p.id} className="mb-1">
    <span className="font-medium">{p.full_name}</span> (ID: {p.patient_id})
  </li>
))}
                </ul>
              )}
            </div>

            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
      {/* --- Enhanced Chatbot Section --- */}
      <div className="mt-8 max-w-2xl mx-auto">
        <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-blue-900">
              <div className="p-2 bg-blue-100 rounded-full">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              AI Radiology Assistant
            </CardTitle>
            <p className="text-sm text-blue-700/80 mt-1">Get instant help with radiology questions and system usage</p>
          </CardHeader>
          <CardContent>
            <Chatbot />
          </CardContent>
        </Card>
      </div>
  </div>
)}

// --- Chatbot Component ---
import React, { useRef } from "react";

const ALLOWED_KEYWORDS = [
  "x-ray", "ct", "mri", "radiology", "ras", "imaging", "ultrasound",
  "pet", "spect", "angiography", "tomography", "radiograph", "sonography",
  "contrast", "scan", "lesion", "tumor", "anatomy", "diagnostic", "slice",
  "radiologist", "nuclear medicine", "echocardiography", "fluoroscopy",
  "mammography", "doppler", "fusion imaging", "bone scan", "chest x-ray",
  "head ct", "abdominal ultrasound", "cardiac mri", "functional mri",
  "diffusion mri", "spect ct", "pet ct", "interventional radiology",
  "ct angiography", "mr angiography", "ultrasound doppler", "radiographic",
  "imaging study", "image reconstruction", "t1 weighted", "t2 weighted",
  "fat suppression", "dynamic imaging", "volumetric imaging", "cross-sectional",
  "non-contrast scan", "brain mri", "spinal ct", "pelvic ultrasound",
  "liver imaging", "kidney imaging", "chest ct", "cardiac ct", "bone density",
  "vascular imaging", "perfusion scan", "diffusion tensor imaging", "mra",
  "ct perfusion", "ct colonography", "ultrasound elastography", "spect scan",
  "pet mri", "x-ray fluoroscopy", "digital radiography", "cect", "cetrastudy",
  "myelography", "angiogram", "imaging protocol", "radiology report",
  "ultrasound guided", "radiation dose"
];

function containsAllowedKeyword(msg: string) {
  return ALLOWED_KEYWORDS.some(k => msg.toLowerCase().includes(k.toLowerCase()));
}

function Chatbot() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string, timestamp: Date }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⚠️ For production, move API key to env variable or backend proxy!
  const API_KEY = "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";
  const API_URL = "https://openrouter.ai/api/v1/chat/completions";

  async function sendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const userMsg = input.trim();
    if (!userMsg) return;
    setInput("");
    setMessages(msgs => [...msgs, { role: 'user', content: userMsg, timestamp: new Date() }]);

    if (!containsAllowedKeyword(userMsg)) {
      setMessages(msgs => [...msgs, { role: 'assistant', content: "Sorry, I can only assist with radiology or system usage questions.", timestamp: new Date() }]);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        model: "deepseek/deepseek-r1-distill-llama-70b",
        messages: [{ role: "user", content: userMsg }],
      };
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setMessages(msgs => [...msgs, { role: 'assistant', content: data.choices?.[0]?.message?.content || "(No response)", timestamp: new Date() }]);
    } catch (err) {
      setMessages(msgs => [...msgs, { role: 'assistant', content: "Sorry, something went wrong.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">AI Assistant</h3>
            <p className="text-blue-100 text-xs">Online • Ready to help</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Clear chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={isExpanded ? "Minimize" : "Expand"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className={`overflow-y-auto bg-gray-50/50 transition-all duration-300 ${isExpanded ? 'h-96' : 'h-64'}`}>
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h4 className="text-gray-600 font-medium mb-2">Welcome to AI Radiology Assistant</h4>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">Ask questions about radiology procedures, imaging techniques, or system usage</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                <button
                  onClick={() => { setInput("What is a CT scan?"); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  What is a CT scan?
                </button>
                <button
                  onClick={() => { setInput("How to read an X-ray?"); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  How to read an X-ray?
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                    </div>
                    <div className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                    }`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-xs mt-1.5 ${
                        msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%]">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Chat Input */}
      <div className="border-t border-gray-100 bg-white p-4">
        <form onSubmit={sendMessage} className="flex items-end gap-3">
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about radiology, imaging, or system usage..."
              disabled={loading}
              maxLength={500}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                {input.length}/500 characters
              </p>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                No patient-identifying information
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition-colors duration-200 flex items-center justify-center min-w-[44px]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

