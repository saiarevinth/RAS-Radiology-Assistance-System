"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, Brain, Activity, AlertCircle, CheckCircle, LogOut, User, UserCheck, FileText, Download, Edit, Save, FileDown, FileUp } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/components/AuthContext"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

interface SegmentationResult {
  image_data_uri: string
  affected_percentage: number
}

// Removed BackendStatus check feature

interface PatientInfo {
  // Medical History
  medicalHistory: string
  previousConditions: string
  currentMedications: string
  familyHistory: string
  knownAllergies: string
  
  // Chief Complaint
  chiefComplaint: string
  
  // Clinical Information
  referringPhysician: string
  neurologicalSymptoms: string
  provisionalDiagnosis: string
  treatmentHistory: string
  onsetOfSymptoms: string
  symptomProgression: string
  additionalNotes: string
}

interface AIReport {
  id: string
  timestamp: string
  patientName: string
  content: string
  isEdited: boolean
  originalContent: string
}

export default function RadiologistAssistance() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<SegmentationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPatientForm, setShowPatientForm] = useState(false)

  // Clear patient data from localStorage on logout
  useEffect(() => {
    if (!user) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("ras_patient_info")
        localStorage.removeItem("ras_patient_name")
        localStorage.removeItem("ras_current_patient")
      }
    }
  }, [user])
  
  // Patient Information State
  const [patientInfo, setPatientInfo] = useState<PatientInfo>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ras_patient_info")
      if (saved) {
        try {
          return JSON.parse(saved) as PatientInfo
        } catch {}
      }
    }
    return {
      medicalHistory: "",
      previousConditions: "",
      currentMedications: "",
      familyHistory: "",
      knownAllergies: "",
      chiefComplaint: "",
      referringPhysician: "",
      neurologicalSymptoms: "",
      provisionalDiagnosis: "",
      treatmentHistory: "",
      onsetOfSymptoms: "",
      symptomProgression: "",
      additionalNotes: ""
    }
  })

  // AI Report State
  const [aiReport, setAiReport] = useState<AIReport | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isEditingReport, setIsEditingReport] = useState(false)
  const [editedReportContent, setEditedReportContent] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [patientName, setPatientName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ras_patient_name") || ""
    }
    return ""
  })
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isSavingReport, setIsSavingReport] = useState(false)
  const [saveReportError, setSaveReportError] = useState<string | null>(null)
  const [activeReportTab, setActiveReportTab] = useState<'view' | 'edit'>('view')

  // Patient Search State
  const [patientSearchId, setPatientSearchId] = useState("")
  const [isSearchingPatient, setIsSearchingPatient] = useState(false)
  const [currentPatient, setCurrentPatient] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ras_current_patient")
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {}
      }
    }
    return null
  })
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null)

  // Backend URL - can be configured via environment variable
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"
  const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"

  // Helper: format AI report content by converting **bold** to <strong> and preserving newlines
  const formatReportHtml = (text: string) => {
    const escapeHtml = (s: string) =>
      (s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    const escaped = escapeHtml(text)
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    return withBold.replace(/\n/g, "<br/>")
  }

  // Helper: sanitize content for jsPDF (remove markdown markers, prettify bullets)
  const sanitizeReportTextForPDF = (text: string) => {
    return (text || "")
      .replace(/\*\*(.+?)\*\*/g, "$1") // remove bold markers
      .replace(/^\s*\*\s+/gm, "• ") // convert bullets
  }

  // Redirect to appropriate page based on role
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/doctor/login")
      } else if (user.role !== "doctor") {
        router.replace("/receptionist/intake")
      }
    }
  }, [loading, user, router])

  // Persist patient info to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ras_patient_info", JSON.stringify(patientInfo))
    }
  }, [patientInfo])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ras_patient_name", patientName)
    }
  }, [patientName])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ras_current_patient", JSON.stringify(currentPatient))
    }
  }, [currentPatient])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Don't render anything if not authenticated or wrong role (will redirect)
  if (!user || user.role !== "doctor") {
    return null
  }

  // Removed backend status check function

  const searchPatient = async () => {
    if (!patientSearchId.trim()) {
      setPatientSearchError("Please enter a patient ID")
      return
    }

    setIsSearchingPatient(true)
    setPatientSearchError(null)
    setCurrentPatient(null)

    try {
      const response = await fetch(`${BACKEND_URL}/api/patients/search-by-id?patient_id=${encodeURIComponent(patientSearchId.trim())}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      setCurrentPatient(result.patient)
      if (typeof window !== "undefined") {
        localStorage.setItem("ras_current_patient", JSON.stringify(result.patient))
      }
      // Auto-populate patient information if available
      if (result.patient.intake) {
        const intake = result.patient.intake
        setPatientName(result.patient.full_name)
        setPatientInfo(prev => ({
          ...prev,
          medicalHistory: intake.previous_condition || "",
          previousConditions: intake.previous_condition || "",
          currentMedications: intake.current_medication || "",
          familyHistory: intake.family_history || "",
          knownAllergies: intake.known_allergy || "",
          chiefComplaint: intake.chief_complaint || "",
          referringPhysician: intake.referring_doctor || "",
          neurologicalSymptoms: intake.neurological_symptom || "",
          treatmentHistory: intake.treatment_history || "",
          symptomProgression: intake.symptom_progression || "",
          additionalNotes: intake.report_content || ""
        }))
        if (typeof window !== "undefined") {
          localStorage.setItem("ras_patient_name", result.patient.full_name)
          localStorage.setItem("ras_patient_info", JSON.stringify({
            medicalHistory: intake.previous_condition || "",
            previousConditions: intake.previous_condition || "",
            currentMedications: intake.current_medication || "",
            familyHistory: intake.family_history || "",
            knownAllergies: intake.known_allergy || "",
            chiefComplaint: intake.chief_complaint || "",
            referringPhysician: intake.referring_doctor || "",
            neurologicalSymptoms: intake.neurological_symptom || "",
            treatmentHistory: intake.treatment_history || "",
            symptomProgression: intake.symptom_progression || "",
            additionalNotes: intake.report_content || ""
          }))
        }
      }

      console.log("Patient found:", result.patient)
    } catch (err: any) {
      console.error("Patient search error:", err)
      setPatientSearchError(err?.message || "Failed to search for patient")
    } finally {
      setIsSearchingPatient(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setError(null)
      setResult(null)

      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handlePatientInfoChange = (field: keyof PatientInfo, value: string) => {
    setPatientInfo(prev => {
      const updated = { ...prev, [field]: value }
      if (typeof window !== "undefined") {
        localStorage.setItem("ras_patient_info", JSON.stringify(updated))
      }
      return updated
    })
  }

  const generateAIReport = async () => {
    if (!result || !patientName.trim()) {
      setError("Please provide patient name and complete segmentation first")
      return
    }

    setIsGeneratingReport(true)
    setError(null)

    try {
      // Prepare context for AI report generation
      const reportContext = {
        patientName: patientName,
        doctorName: user.full_name,
        doctorSpecialty: user.specialty,
        affectedPercentage: result.affected_percentage,
        patientInfo: patientInfo,
        timestamp: new Date().toISOString()
      }

      // Generate AI report using Ollama
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2", // or any other model you have
          prompt: `Generate a comprehensive medical report for a radiologist based on the following information:

PATIENT INFORMATION:
- Name: ${reportContext.patientName}
- Chief Complaint: ${patientInfo.chiefComplaint}
- Medical History: ${patientInfo.medicalHistory}
- Current Medications: ${patientInfo.currentMedications}
- Known Allergies: ${patientInfo.knownAllergies}
- Family History: ${patientInfo.familyHistory}

CLINICAL INFORMATION:
- Referring Physician: ${patientInfo.referringPhysician}
- Neurological Symptoms: ${patientInfo.neurologicalSymptoms}
- Provisional Diagnosis: ${patientInfo.provisionalDiagnosis}
- Onset of Symptoms: ${patientInfo.onsetOfSymptoms}
- Symptom Progression: ${patientInfo.symptomProgression}
- Treatment History: ${patientInfo.treatmentHistory}

AI ANALYSIS RESULTS:
- Affected Area Percentage: ${result.affected_percentage}%
- Analysis Performed By: ${user.full_name} (${user.specialty})

Please generate a structured medical report including:
1. Patient Demographics
2. Clinical History
3. Imaging Findings
4. AI Analysis Results
5. Differential Diagnosis
6. Recommendations
7. Follow-up Instructions

Format the report professionally for medical documentation.`,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate AI report")
      }

      const data = await response.json()
      const generatedContent = data.response || "Unable to generate report at this time."

      const newReport: AIReport = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        patientName: patientName,
        content: generatedContent,
        isEdited: false,
        originalContent: generatedContent
      }

      setAiReport(newReport)
      setEditedReportContent(generatedContent)
    } catch (err) {
      console.error("AI Report generation error:", err)
      setError("Failed to generate AI report. Please try again.")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const startEditingReport = () => {
    setIsEditingReport(true)
    setEditedReportContent(aiReport?.content || "")
    setActiveReportTab('edit')
  }

  const saveEditedReport = () => {
    console.log("Saving edited report...")
    console.log("Current aiReport:", aiReport)
    console.log("Edited content:", editedReportContent)
    
    if (aiReport) {
      const updatedReport = {
        ...aiReport,
        content: editedReportContent,
        isEdited: true
      }
      console.log("Updated report:", updatedReport)
      setAiReport(updatedReport)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000) // Hide success message after 3 seconds
    }
    setIsEditingReport(false)
    console.log("Save completed, switching to view mode")
    setActiveReportTab('view')
  }

  const cancelEditing = () => {
    setEditedReportContent(aiReport?.content || "")
    setIsEditingReport(false)
  }

  const exportReport = async (format: 'html' | 'pdf' | 'docx') => {
    if (!aiReport) return

    setIsExporting(true)
    try {
      const reportData = {
        patientName: aiReport.patientName,
        doctorName: user.full_name,
        doctorSpecialty: user.specialty,
        timestamp: aiReport.timestamp,
        content: isEditingReport ? editedReportContent : aiReport.content,
        patientInfo: patientInfo,
        affectedPercentage: result?.affected_percentage,
        isEdited: aiReport.isEdited
      }

      if (format === 'pdf') {
        // For PDF, we'll create a proper PDF using html2pdf or similar
        // For now, let's use a simple approach with print-to-PDF
        await exportAsPDF(reportData)
      } else {
        // For HTML and DOCX, use the backend
        const response = await fetch(`${BACKEND_URL}/export-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            format,
            reportData
          })
        })

        if (!response.ok) {
          throw new Error("Failed to export report")
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${aiReport.patientName}_Medical_Report.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error("Export error:", err)
      setError("Failed to export report. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  const exportAsPDF = async (reportData: any) => {
    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      
      // Set initial position
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.width
      const margin = 20
      const contentWidth = pageWidth - (2 * margin)
      
      // Helper function to add text with word wrapping
      const addWrappedText = (text: string, y: number, fontSize: number = 12, isBold: boolean = false) => {
        doc.setFontSize(fontSize)
        doc.setFont('helvetica', isBold ? 'bold' : 'normal')
        
        const lines = doc.splitTextToSize(text, contentWidth)
        if (y + (lines.length * fontSize * 0.4) > doc.internal.pageSize.height - 20) {
          doc.addPage()
          y = 20
        }
        
        doc.text(lines, margin, y)
        return y + (lines.length * fontSize * 0.4) + 5
      }
      
      // Title
      yPosition = addWrappedText('Medical Imaging Report', yPosition, 18, true)
      yPosition = addWrappedText(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, yPosition, 10)
      yPosition += 10
      
      // Patient Information Section
      yPosition = addWrappedText('Patient Information', yPosition, 14, true)
      yPosition += 5
      
      const patientInfo = [
        `Patient Name: ${reportData.patientName}`,
        `Referring Physician: ${reportData.patientInfo.referringPhysician || 'N/A'}`,
        `Report Generated By: ${reportData.doctorName} (${reportData.doctorSpecialty})`,
        `Chief Complaint: ${reportData.patientInfo.chiefComplaint || 'N/A'}`,
        `Affected Area: ${reportData.affectedPercentage}%`,
        `Report Status: ${reportData.isEdited ? 'Edited' : 'AI Generated'}`
      ]
      
      patientInfo.forEach(info => {
        yPosition = addWrappedText(info, yPosition, 10)
      })
      yPosition += 10
      
      // Clinical History Section
      yPosition = addWrappedText('Clinical History', yPosition, 14, true)
      yPosition += 5
      
      const clinicalHistory = [
        `Medical History: ${reportData.patientInfo.medicalHistory || 'N/A'}`,
        `Current Medications: ${reportData.patientInfo.currentMedications || 'N/A'}`,
        `Known Allergies: ${reportData.patientInfo.knownAllergies || 'N/A'}`,
        `Family History: ${reportData.patientInfo.familyHistory || 'N/A'}`
      ]
      
      clinicalHistory.forEach(history => {
        yPosition = addWrappedText(history, yPosition, 10)
      })
      yPosition += 10
      
      // AI Analysis Report Section
      yPosition = addWrappedText('AI Analysis Report', yPosition, 14, true)
      yPosition += 5
      
      // Split the AI report content into paragraphs for better formatting (plain text for jsPDF)
      const reportContent = sanitizeReportTextForPDF(reportData.content || 'No report content available')
      const paragraphs = reportContent.split('\n\n').filter((p: string) => p.trim())
      
      paragraphs.forEach((paragraph: string) => {
        yPosition = addWrappedText(paragraph.trim(), yPosition, 10)
        yPosition += 3
      })
      
      // Footer
      yPosition += 10
      yPosition = addWrappedText('This report was generated using AI-assisted medical imaging analysis.', yPosition, 10)
      yPosition = addWrappedText('Please review all findings with qualified medical professionals.', yPosition, 10)
      
      // Save the PDF
      doc.save(`${reportData.patientName}_Medical_Report.pdf`)
      
    } catch (error) {
      console.error('PDF generation error:', error)
      // Fallback to print method if jsPDF fails
      console.log('Falling back to print method...')
      await exportAsPDFFallback(reportData)
    }
  }

  const exportAsPDFFallback = async (reportData: any) => {
    // Fallback method using print dialog
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) {
      throw new Error("Popup blocked. Please allow popups for this site.")
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Medical Report - ${reportData.patientName}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.6;
            color: #333;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .section { 
            margin-bottom: 25px; 
            page-break-inside: avoid;
          }
          .section h2 { 
            color: #2c5aa0; 
            border-bottom: 1px solid #ccc; 
            padding-bottom: 5px; 
            margin-top: 30px;
          }
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px; 
            margin-bottom: 20px;
          }
          .patient-info { 
            background: #f5f5f5; 
            padding: 15px; 
            border-radius: 5px; 
            border: 1px solid #ddd;
          }
          .report-content { 
            white-space: pre-wrap; 
            line-height: 1.6; 
            background: #fafafa;
            padding: 15px;
            border-radius: 5px;
            border: 1px solid #eee;
          }
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            font-size: 12px; 
            color: #666; 
            border-top: 1px solid #ccc;
            padding-top: 20px;
          }
          @media print {
            body { margin: 20px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Medical Imaging Report</h1>
          <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
        
        <div class="section">
          <h2>Patient Information</h2>
          <div class="info-grid">
            <div class="patient-info">
              <strong>Patient Name:</strong> ${reportData.patientName}<br>
              <strong>Referring Physician:</strong> ${reportData.patientInfo.referringPhysician || 'N/A'}<br>
              <strong>Report Generated By:</strong> ${reportData.doctorName} (${reportData.doctorSpecialty})
            </div>
            <div class="patient-info">
              <strong>Chief Complaint:</strong> ${reportData.patientInfo.chiefComplaint || 'N/A'}<br>
              <strong>Affected Area:</strong> ${reportData.affectedPercentage}%<br>
              <strong>Report Status:</strong> ${reportData.isEdited ? 'Edited' : 'AI Generated'}
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Clinical History</h2>
          <div class="patient-info">
            <strong>Medical History:</strong> ${reportData.patientInfo.medicalHistory || 'N/A'}<br><br>
            <strong>Current Medications:</strong> ${reportData.patientInfo.currentMedications || 'N/A'}<br><br>
            <strong>Known Allergies:</strong> ${reportData.patientInfo.knownAllergies || 'N/A'}<br><br>
            <strong>Family History:</strong> ${reportData.patientInfo.familyHistory || 'N/A'}
          </div>
        </div>
        
        <div class="section">
          <h2>AI Analysis Report</h2>
          <div class="report-content">${formatReportHtml(reportData.content)}</div>
        </div>
        
        <div class="footer">
          <p>This report was generated using AI-assisted medical imaging analysis.</p>
          <p>Please review all findings with qualified medical professionals.</p>
        </div>
        
        <script>
          // Auto-print the page
          window.onload = function() {
            window.print();
            // Close the window after printing
            setTimeout(function() {
              window.close();
            }, 1000);
          };
        </script>
      </body>
      </html>
    `

    reportWindow.document.write(htmlContent)
    reportWindow.document.close()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!selectedFile) {
      setError("Please select an image file")
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("image", selectedFile)
      
      // Add patient information to form data
      Object.entries(patientInfo).forEach(([key, value]) => {
        formData.append(`patient_${key}`, value)
      })

      const response = await fetch(`${BACKEND_URL}/segment`, {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error occurred" }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data: SegmentationResult = await response.json()
      setResult(data)
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setError(
          `Network error: Cannot connect to backend at ${BACKEND_URL}. Please ensure the Flask server is running.`,
        )
      } else {
        setError(err instanceof Error ? err.message : "An error occurred during processing")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Save AI/Edited report to DB by updating latest patient report (doctor role required)
  const saveReportToDB = async () => {
    if (!aiReport || !currentPatient || !currentPatient.medical_reports || currentPatient.medical_reports.length === 0) {
      setSaveReportError("No existing report found to update. Ask reception to create a report for this patient.")
      return
    }
    try {
      setIsSavingReport(true)
      setSaveReportError(null)

      const latestReport = currentPatient.medical_reports[0]
      const payload = {
        ai_generated_report: aiReport.content,
        doctor_review: editedReportContent || aiReport.content,
        affected_percentage: result?.affected_percentage,
      }

      const resp = await fetch(`${BACKEND_URL}/api/reports/${latestReport.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to save report (HTTP ${resp.status})`)
      }

      // Refresh local patient reports list to reflect changes
      try {
        const refreshed = await fetch(`${BACKEND_URL}/api/patients/search-by-id?patient_id=${encodeURIComponent(currentPatient.patient_id)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        })
        if (refreshed.ok) {
          const json = await refreshed.json()
          setCurrentPatient(json.patient)
        }
      } catch {}

      // Trigger attended patients refresh event for doctor profile page
      if (typeof window !== "undefined") {
        localStorage.setItem("ras_attended_patients_refresh", Date.now().toString())
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: any) {
      setSaveReportError(e?.message || "Failed to save report to DB")
    } finally {
      setIsSavingReport(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with user info and logout */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Radiologist Assistance System</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium cursor-pointer text-blue-700 hover:underline" onClick={() => router.push(`/doctor/profile?email=${encodeURIComponent(user.email)}`)}>{user.full_name}</span>
              </div>
              <div className="text-xs text-gray-500">
                {user.specialty} • {user.department}
              </div>
            </div>
            <Button onClick={logout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="text-center mb-8">
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload medical images for AI-powered segmentation analysis. Our system uses advanced deep learning to
            identify and highlight areas of interest in radiological images.
          </p>
        </div>

        {/* Backend status card removed */}

        {/* Patient Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Patient Search
            </CardTitle>
            <CardDescription>Search for existing patients by their Patient ID to load their information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="patientSearchId">Patient ID</Label>
                <Input
                  id="patientSearchId"
                  placeholder="Enter Patient ID (e.g., PAT-20241201-ABC12345)"
                  value={patientSearchId}
                  onChange={(e) => setPatientSearchId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchPatient()}
                />
              </div>
              <Button 
                onClick={searchPatient} 
                disabled={isSearchingPatient || !patientSearchId.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSearchingPatient ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <User className="mr-2 h-4 w-4" />
                    Search Patient
                  </>
                )}
              </Button>
            </div>

            {patientSearchError && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {patientSearchError}
                </AlertDescription>
              </Alert>
            )}

            {currentPatient && (
              <div className="mt-6 space-y-4">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-2">Patient Found</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Name:</span>
                      <p className="text-green-800">{currentPatient.full_name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Patient ID:</span>
                      <p className="text-green-800">{currentPatient.patient_id}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Age:</span>
                      <p className="text-green-800">{currentPatient.intake?.age || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Contact:</span>
                      <p className="text-green-800">{currentPatient.intake?.contact_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {currentPatient.intake && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">Intake Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Chief Complaint:</span>
                        <p className="text-blue-800">{currentPatient.intake.chief_complaint || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Referring Doctor:</span>
                        <p className="text-blue-800">{currentPatient.intake.referring_doctor || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Previous Conditions:</span>
                        <p className="text-blue-800">{currentPatient.intake.previous_condition || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Current Medications:</span>
                        <p className="text-blue-800">{currentPatient.intake.current_medication || 'N/A'}</p>
                      </div>
                    </div>
                    {/* Uploaded Intake PDF */}
                    {currentPatient.intake.previous_report_pdf && (
                      <div className="mt-4 p-3 bg-white rounded border flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium text-gray-700">Uploaded Report (PDF): </span>
                          <span className="text-gray-600">
                            {(() => {
                              const fullPath = currentPatient.intake.previous_report_pdf as string
                              const fileName = fullPath.split(/[/\\]/).pop()
                              return fileName || 'report.pdf'
                            })()}
                          </span>
                        </div>
                        {(() => {
                          const fullPath = currentPatient.intake.previous_report_pdf as string
                          const fileName = fullPath.split(/[/\\]/).pop()
                          const href = fileName ? `${BACKEND_URL}/uploads/${fileName}` : undefined
                          return href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                View / Download
                              </Button>
                            </a>
                          ) : null
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {currentPatient.medical_reports && currentPatient.medical_reports.length > 0 && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-2">Previous Reports ({currentPatient.medical_reports.length})</h4>
                    <div className="space-y-2">
                      {currentPatient.medical_reports.map((report: any, index: number) => (
                        <div key={report.id} className="bg-white p-3 rounded border">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-purple-800">{report.report_type}</p>
                              <p className="text-sm text-gray-600">
                                {new Date(report.report_date).toLocaleDateString()} - {report.status}
                              </p>
                            </div>
                            {report.original_pdf_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`${BACKEND_URL}/uploads/${report.original_pdf_path.split('/').pop()}`, '_blank')}
                              >
                                <FileDown className="mr-2 h-4 w-4" />
                                View PDF
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Patient Information & Upload Section */}
          <div className="space-y-6">
            {/* Patient Information Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Patient Information
                  {currentPatient && (
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">Patient Data Loaded</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {currentPatient 
                    ? `Patient data loaded for ${currentPatient.full_name} (${currentPatient.patient_id})`
                    : "Enter patient details for comprehensive analysis"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentPatient && (
                  <Alert className="mb-4 border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Patient information loaded from database. You can now proceed with image analysis.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4">
                  {/* Patient Name */}
                  <div className="space-y-2">
                    <Label htmlFor="patientName">Patient Name *</Label>
                    <Input
                      id="patientName"
                      placeholder="Enter patient's full name"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Medical History Section */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Medical History</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="medicalHistory">Medical History</Label>
                      <Textarea
                        id="medicalHistory"
                        placeholder="Enter relevant medical history..."
                        value={patientInfo.medicalHistory}
                        onChange={(e) => handlePatientInfoChange("medicalHistory", e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="previousConditions">Previous Medical Conditions</Label>
                      <Textarea
                        id="previousConditions"
                        placeholder="List any previous medical conditions..."
                        value={patientInfo.previousConditions}
                        onChange={(e) => handlePatientInfoChange("previousConditions", e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currentMedications">Current Medications (name + dosage)</Label>
                      <Textarea
                        id="currentMedications"
                        placeholder="List current medications with dosages..."
                        value={patientInfo.currentMedications}
                        onChange={(e) => handlePatientInfoChange("currentMedications", e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="familyHistory">Family History (relevant genetic/medical background)</Label>
                      <Textarea
                        id="familyHistory"
                        placeholder="Enter relevant family medical history..."
                        value={patientInfo.familyHistory}
                        onChange={(e) => handlePatientInfoChange("familyHistory", e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="knownAllergies">Known Allergies (including medications, contrast agents)</Label>
                      <Textarea
                        id="knownAllergies"
                        placeholder="List all known allergies..."
                        value={patientInfo.knownAllergies}
                        onChange={(e) => handlePatientInfoChange("knownAllergies", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Chief Complaint */}
                  <div className="space-y-2">
                    <Label htmlFor="chiefComplaint">Chief Complaint / Symptoms</Label>
                    <Textarea
                      id="chiefComplaint"
                      placeholder="Main reason for examination and current symptoms..."
                      value={patientInfo.chiefComplaint}
                      onChange={(e) => handlePatientInfoChange("chiefComplaint", e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Clinical Information Section */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Clinical Information</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="referringPhysician">Referring Physician</Label>
                      <Input
                        id="referringPhysician"
                        placeholder="Name of doctor requesting the scan/report"
                        value={patientInfo.referringPhysician}
                        onChange={(e) => handlePatientInfoChange("referringPhysician", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="neurologicalSymptoms">Neurological Symptoms</Label>
                      <Select value={patientInfo.neurologicalSymptoms} onValueChange={(value) => handlePatientInfoChange("neurologicalSymptoms", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select neurological symptoms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="headache">Headache</SelectItem>
                          <SelectItem value="seizures">Seizures</SelectItem>
                          <SelectItem value="memory_loss">Memory Loss</SelectItem>
                          <SelectItem value="vision_problems">Vision Problems</SelectItem>
                          <SelectItem value="numbness">Numbness/Tingling</SelectItem>
                          <SelectItem value="weakness">Weakness</SelectItem>
                          <SelectItem value="speech_problems">Speech Problems</SelectItem>
                          <SelectItem value="balance_issues">Balance Issues</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="provisionalDiagnosis">Provisional Diagnosis</Label>
                      <Input
                        id="provisionalDiagnosis"
                        placeholder="Initial suspected diagnosis"
                        value={patientInfo.provisionalDiagnosis}
                        onChange={(e) => handlePatientInfoChange("provisionalDiagnosis", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="treatmentHistory">Treatment History</Label>
                      <Textarea
                        id="treatmentHistory"
                        placeholder="Previous treatments tried for this condition..."
                        value={patientInfo.treatmentHistory}
                        onChange={(e) => handlePatientInfoChange("treatmentHistory", e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="onsetOfSymptoms">Onset of Symptoms</Label>
                      <Select value={patientInfo.onsetOfSymptoms} onValueChange={(value) => handlePatientInfoChange("onsetOfSymptoms", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="acute">Acute (&lt; 24 hours)</SelectItem>
                          <SelectItem value="subacute">Subacute (1-7 days)</SelectItem>
                          <SelectItem value="chronic">Chronic (&gt; 1 week)</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="symptomProgression">Symptom Progression</Label>
                      <Select value={patientInfo.symptomProgression} onValueChange={(value) => handlePatientInfoChange("symptomProgression", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select progression" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="improving">Improving</SelectItem>
                          <SelectItem value="worsening">Worsening</SelectItem>
                          <SelectItem value="stable">Stable</SelectItem>
                          <SelectItem value="fluctuating">Fluctuating</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="additionalNotes">Additional Clinical Notes</Label>
                      <Textarea
                        id="additionalNotes"
                        placeholder="Extra observations, comments, or relevant clinical information..."
                        value={patientInfo.additionalNotes}
                        onChange={(e) => handlePatientInfoChange("additionalNotes", e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Image Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Image Upload
              </CardTitle>
              <CardDescription>Select a medical image for segmentation</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Model path input removed: using default model on backend */}

                <div className="space-y-2">
                  <Label htmlFor="image">Medical Image</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    required
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-gray-500">Supported formats: JPEG, PNG, TIFF, DICOM</p>
                </div>

                {previewUrl && (
                  <div className="space-y-2">
                    <Label>Original Image Preview</Label>
                    <div className="border rounded-lg p-2 bg-gray-50">
                      <Image
                        src={previewUrl || "/placeholder.svg"}
                        alt="Original image preview"
                        width={400}
                        height={300}
                        className="max-w-full h-auto rounded"
                        style={{ objectFit: "contain" }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isProcessing || !selectedFile}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Image...
                    </>
                  ) : (
                    <>
                      <Activity className="mr-2 h-4 w-4" />
                      Run Segmentation Analysis
                    </>
                  )}
                </Button>
              </form>

              {error && (
                <Alert className="mt-4 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Results & Report Section */}
          <div className="space-y-6">
            {/* Segmentation Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Segmentation Results
              </CardTitle>
              <CardDescription>AI-generated segmentation overlay and analysis metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-blue-900 mb-2">Analysis Metrics</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-blue-700">Affected Area:</span>
                      <span className="font-bold text-lg text-blue-900">{result.affected_percentage}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Segmentation Overlay</Label>
                    <div className="border rounded-lg p-2 bg-gray-50">
                      <Image
                        src={result.image_data_uri || "/placeholder.svg"}
                        alt="Segmentation overlay"
                        width={500}
                        height={400}
                        className="max-w-full h-auto rounded"
                        style={{ objectFit: "contain" }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">Red overlay indicates detected regions of interest</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Analysis Notes</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Segmentation performed using ResUNet50 architecture</li>
                      <li>• Red regions indicate areas flagged by the AI model</li>
                      <li>• Results should be reviewed by qualified radiologists</li>
                      <li>• This tool is for assistance purposes only</li>
                    </ul>
                  </div>

                    {/* Generate AI Report Button */}
                    <div className="pt-4 border-t">
                      <Button
                        onClick={generateAIReport}
                        disabled={isGeneratingReport || !patientName.trim()}
                        className="w-full"
                      >
                        {isGeneratingReport ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating AI Report...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" />
                            Generate AI Medical Report
                          </>
                        )}
                      </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Upload an image and run segmentation to see results here</p>
                  
                </div>
              )}
            </CardContent>
          </Card>

            {/* AI Report Section */}
            {aiReport && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    AI Medical Report
                    {aiReport.isEdited && (
                      <Badge variant="secondary" className="text-xs">Edited</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Generated for {aiReport.patientName} on {new Date(aiReport.timestamp).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeReportTab} onValueChange={(v) => setActiveReportTab(v as 'view' | 'edit')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="view">View Report</TabsTrigger>
                      <TabsTrigger value="edit">Edit Report</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="view" className="space-y-4">
                      <div className="bg-white border rounded-lg p-4 max-h-96 overflow-y-auto">
                        <div
                          className="whitespace-pre-wrap text-sm font-mono"
                          dangerouslySetInnerHTML={{ __html: formatReportHtml(aiReport.content) }}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={startEditingReport}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Report
                        </Button>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isExporting}>
                              <Download className="mr-2 h-4 w-4" />
                              Export Report
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Export Medical Report</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-gray-600">
                                Choose the format to export the medical report for {aiReport.patientName}:
                              </p>
                              <div className="grid grid-cols-1 gap-2">
                                <Button
                                  onClick={() => exportReport('pdf')}
                                  disabled={isExporting}
                                  className="justify-start"
                                >
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Export as PDF
                                </Button>
                                <Button
                                  onClick={() => exportReport('docx')}
                                  disabled={isExporting}
                                  className="justify-start"
                                >
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Export as Word Document (.docx)
                                </Button>
                                <Button
                                  onClick={() => exportReport('html')}
                                  disabled={isExporting}
                                  className="justify-start"
                                >
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Export as HTML
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button onClick={saveReportToDB} size="sm" disabled={isSavingReport || !currentPatient} className="ml-auto">
                          {isSavingReport ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save to DB
                            </>
                          )}
                        </Button>
                      </div>
                      {saveReportError && (
                        <Alert className="mt-2 border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800">{saveReportError}</AlertDescription>
                        </Alert>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="edit" className="space-y-4">
                      {saveSuccess && (
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            Report saved successfully!
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="space-y-2">
                        <Label>Edit Report Content</Label>
                        <Textarea
                          value={editedReportContent}
                          onChange={(e) => setEditedReportContent(e.target.value)}
                          rows={15}
                          className="font-mono text-sm"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={saveEditedReport}
                          size="sm"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </Button>
                        <Button
                          onClick={cancelEditing}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                      {saveReportError && (
                        <Alert className="mt-2 border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800">{saveReportError}</AlertDescription>
                        </Alert>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            This system uses advanced AI for medical image analysis. Always consult with qualified medical professionals
            for diagnosis and treatment decisions.
          </p>
        </div>
      </div>
    </div>
  )
}
