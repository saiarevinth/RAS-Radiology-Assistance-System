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

export default function DoctorProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [assignedPatients, setAssignedPatients] = useState([])
  const [attendedPatients, setAttendedPatients] = useState([])
  const [error, setError] = useState(null)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Doctor Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-lg">{user.full_name}</span>
                <span className="ml-2 text-gray-500">({user.specialty || user.department})</span>
              </div>
              <div className="text-sm text-gray-500">{user.email}</div>
            </div>

            <div className="mb-8">
              <h3 className="font-semibold text-blue-900 mb-2">Assigned Patients</h3>
              {assignedPatients.length === 0 ? (
                <p className="text-gray-600">No assigned patients.</p>
              ) : (
                <ul className="list-disc ml-6">
                  {assignedPatients.map((p: any) => {
                    const isAttended = attendedPatients.some((ap: any) => ap.id === p.id)
                    return (
                      <li key={p.id} className="mb-1 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAttended}
                          disabled={isAttended}
                          onChange={async () => {
                            if (!isAttended) {
                              try {
                                const resp = await fetch(`${BACKEND_URL}/api/doctor/${user.id}/attend-patient`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({ patient_id: p.id }),
                                })
                                if (resp.ok) {
                                  fetchAttendedPatients()
                                  // Optionally, trigger the attended patients refresh event for other tabs
                                  if (typeof window !== "undefined") {
                                    localStorage.setItem("ras_attended_patients_refresh", Date.now().toString())
                                  }
                                } else {
                                  setError("Failed to mark patient as attended")
                                }
                              } catch {
                                setError("Failed to mark patient as attended")
                              }
                            }
                          }}
                        />
                        <span className="font-medium">{p.full_name}</span> (ID: {p.patient_id})
                        {isAttended && (
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
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
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
