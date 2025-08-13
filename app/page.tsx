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

interface BackendStatus {
  connected: boolean
  message: string
}

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
  const [modelPath, setModelPath] = useState("ResUNet50.pth")
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<SegmentationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ connected: false, message: "Not checked" })
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  const [showPatientForm, setShowPatientForm] = useState(false)
  
  // Patient Information State
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
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
  })

  // AI Report State
  const [aiReport, setAiReport] = useState<AIReport | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isEditingReport, setIsEditingReport] = useState(false)
  const [editedReportContent, setEditedReportContent] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [patientName, setPatientName] = useState("")
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Backend URL - can be configured via environment variable
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"
  const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434"

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

  const checkBackendStatus = async () => {
    setIsCheckingBackend(true)
    try {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        setBackendStatus({ connected: true, message: "Backend connected successfully" })
      } else {
        setBackendStatus({ connected: false, message: `Backend responded with status ${response.status}` })
      }
    } catch (err) {
      setBackendStatus({
        connected: false,
        message: `Cannot connect to backend at ${BACKEND_URL}. Make sure Flask server is running.`,
      })
    } finally {
      setIsCheckingBackend(false)
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
    setPatientInfo(prev => ({
      ...prev,
      [field]: value
    }))
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
        content: aiReport.content,
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
      
      // Split the AI report content into paragraphs for better formatting
      const reportContent = reportData.content || 'No report content available'
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
          <div class="report-content">${reportData.content}</div>
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

    if (!backendStatus.connected) {
      setError("Backend is not connected. Please check the connection first.")
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("image", selectedFile)
      formData.append("model_path", modelPath)
      
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
                <span className="font-medium">{user.full_name}</span>
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

        {/* Backend Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Backend Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {backendStatus.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className={backendStatus.connected ? "text-green-700" : "text-red-700"}>
                  {backendStatus.message}
                </span>
              </div>
              <Button onClick={checkBackendStatus} disabled={isCheckingBackend} variant="outline" size="sm">
                {isCheckingBackend ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Check Connection"
                )}
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-2">Backend URL: {BACKEND_URL}</p>
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
                </CardTitle>
                <CardDescription>Enter patient details for comprehensive analysis</CardDescription>
              </CardHeader>
              <CardContent>
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
                Image Upload & Configuration
              </CardTitle>
              <CardDescription>Select a medical image and configure the segmentation model</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="model_path">Model Path</Label>
                  <Input
                    id="model_path"
                    type="text"
                    value={modelPath}
                    onChange={(e) => setModelPath(e.target.value)}
                    placeholder="resunet50_brain_segmentation.pth"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Specify the model file path (relative to Flask project folder or absolute path)
                  </p>
                </div>

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
                  disabled={isProcessing || !selectedFile || !backendStatus.connected}
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
                  {!backendStatus.connected && (
                    <p className="text-red-500 text-sm mt-2">Please check backend connection first</p>
                  )}
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
                  <Tabs defaultValue="view" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="view">View Report</TabsTrigger>
                      <TabsTrigger value="edit">Edit Report</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="view" className="space-y-4">
                      <div className="bg-white border rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm font-mono">{aiReport.content}</pre>
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
                      </div>
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
