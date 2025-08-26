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
    </div>
  )
}
