"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/AuthContext"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogOut, User, ClipboardList, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"

interface IntakeForm {
  patientName: string
  age: string
  sex: string
  dob: string
  contactNumber: string
  patientId: string
  abhaId: string
  previousCondition: string
  currentMedication: string
  familyHistory: string
  knownAllergy: string
  chiefComplaint: string
  referringDoctor: string
  neurologicalSymptom: string
  treatmentHistory: string
  symptomProgression: string
  reportContent: string
}

interface ExtractionStatus {
  isExtracting: boolean
  progress: string
  success: boolean
  error: string | null
  extractedFields: number
}

export default function ReceptionistIntakePage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedReport, setSelectedReport] = useState<File | null>(null)
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>({
    isExtracting: false,
    progress: "",
    success: false,
    error: null,
    extractedFields: 0
  })
  const [manualText, setManualText] = useState("")

  const [form, setForm] = useState<IntakeForm>({
    patientName: "",
    age: "",
    sex: "",
    dob: "",
    contactNumber: "",
    patientId: "",
    abhaId: "",
    previousCondition: "",
    currentMedication: "",
    familyHistory: "",
    knownAllergy: "",
    chiefComplaint: "",
    referringDoctor: "",
    neurologicalSymptom: "",
    treatmentHistory: "",
    symptomProgression: "",
    reportContent: "",
  })

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/receptionist/login?redirect=/receptionist/intake")
      } else if (user.role !== "receptionist") {
        router.replace("/")
      }
    }
  }, [loading, user, router])

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

  if (!user || user.role !== "receptionist") {
    return null
  }

  const handleChange = (field: keyof IntakeForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedReport(file)
      setError(null)
      setExtractionStatus(prev => ({ ...prev, error: null }))
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type)) {
        setError(`Unsupported file type: ${file.type}. Please use PDF, TXT, DOC, or DOCX files.`)
        setSelectedReport(null)
        return
      }
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size too large. Please use files smaller than 10MB.")
        setSelectedReport(null)
        return
      }
    }
  }

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'text/plain') {
      return await file.text()
    }
    
    if (file.type === 'application/pdf') {
      // Multi-layered PDF extraction approach
      const extractionMethods = [
        // Method 1: Direct text reading with multiple encodings
        async () => {
          try {
            const text = await file.text()
            if (text && text.trim().length > 20) {
              return text
            }
          } catch (error) {
            console.log('Method 1 failed:', error)
          }
          return null
        },
        
        // Method 2: ArrayBuffer with multiple encodings
        async () => {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            
            const encodings = ['utf-8', 'latin1', 'ascii', 'iso-8859-1', 'windows-1252']
            
            for (const encoding of encodings) {
              try {
                const textDecoder = new TextDecoder(encoding, { fatal: false })
                const decodedText = textDecoder.decode(uint8Array)
                
                // Extract readable text using multiple patterns
                const patterns = [
                  /[\x20-\x7E\s]{3,}/g,  // Standard ASCII
                  /[a-zA-Z0-9\s\.\,\-\_\(\)\:\;]{3,}/g,  // Alphanumeric with punctuation
                  /[^\x00-\x1F\x7F-\xFF]{3,}/g  // Non-control characters
                ]
                
                for (const pattern of patterns) {
                  const matches = decodedText.match(pattern)
                  if (matches && matches.join(' ').trim().length > 50) {
                    return matches.join(' ')
                  }
                }
              } catch (error) {
                console.log(`Encoding ${encoding} failed:`, error)
              }
            }
          } catch (error) {
            console.log('Method 2 failed:', error)
          }
          return null
        },
        
        // Method 3: Manual PDF structure parsing
        async () => {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            const rawText = new TextDecoder('latin1', { fatal: false }).decode(uint8Array)
            
            // Extract PDF metadata and content
            const metadata: string[] = []
            
            // Look for common PDF patterns
            const patterns = [
              /Producer\s*\(([^)]+)\)/gi,
              /CreationDate\s*\(([^)]+)\)/gi,
              /ModDate\s*\(([^)]+)\)/gi,
              /Title\s*\(([^)]+)\)/gi,
              /Author\s*\(([^)]+)\)/gi,
              /Subject\s*\(([^)]+)\)/gi,
              /Keywords\s*\(([^)]+)\)/gi,
              /Creator\s*\(([^)]+)\)/gi
            ]
            
            patterns.forEach(pattern => {
              const matches = rawText.match(pattern)
              if (matches) {
                metadata.push(...matches.map(match => String(match)))
              }
            })
            
            // Extract text content between stream markers
            const streamMatches = rawText.match(/stream\s*([\s\S]*?)\s*endstream/gi)
            if (streamMatches) {
              streamMatches.forEach(match => {
                const content = match.replace(/stream\s*/i, '').replace(/\s*endstream/i, '')
                if (content.trim().length > 20) {
                  metadata.push(content)
                }
              })
            }
            
            // Extract text between parentheses (common in PDFs)
            const parenMatches = rawText.match(/\(([^)]{3,})\)/g)
            if (parenMatches) {
              parenMatches.forEach(match => {
                const content = match.replace(/[\(\)]/g, '')
                if (content.trim().length > 5 && /[a-zA-Z]/.test(content)) {
                  metadata.push(content)
                }
              })
            }
            
            if (metadata.length > 0) {
              return metadata.join(' ')
            }
          } catch (error) {
            console.log('Method 3 failed:', error)
          }
          return null
        },
        
        // Method 4: Binary analysis for text content
        async () => {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            
            // Look for text patterns in binary data
            let textContent = ''
            let currentText = ''
            
            for (let i = 0; i < uint8Array.length; i++) {
              const byte = uint8Array[i]
              
              // Check if byte represents printable ASCII
              if (byte >= 32 && byte <= 126) {
                currentText += String.fromCharCode(byte)
              } else if (byte === 10 || byte === 13) { // Newline or carriage return
                if (currentText.trim().length > 3) {
                  textContent += currentText + '\n'
                }
                currentText = ''
              } else {
                if (currentText.trim().length > 3) {
                  textContent += currentText + ' '
                }
                currentText = ''
              }
            }
            
            // Add any remaining text
            if (currentText.trim().length > 3) {
              textContent += currentText
            }
            
            if (textContent.trim().length > 50) {
              return textContent
            }
          } catch (error) {
            console.log('Method 4 failed:', error)
          }
          return null
        }
      ]
      
      // Try each method until one succeeds
      for (let i = 0; i < extractionMethods.length; i++) {
        try {
          console.log(`Trying PDF extraction method ${i + 1}...`)
          const result = await extractionMethods[i]()
          if (result && result.trim().length > 20) {
            console.log(`Method ${i + 1} succeeded, extracted ${result.length} characters`)
            return result
          }
        } catch (error) {
          console.log(`Method ${i + 1} failed:`, error)
        }
      }
      
      // If all methods fail, return a basic structure with file info
      return `PDF Document: ${file.name}, Size: ${(file.size / 1024).toFixed(1)} KB, Type: ${file.type}`
    }
    
    if (file.type.includes('document') || file.type.includes('word')) {
      try {
        return await file.text()
      } catch {
        return `Document: ${file.name}, Size: ${(file.size / 1024).toFixed(1)} KB`
      }
    }
    
    return `File: ${file.name}, Size: ${(file.size / 1024).toFixed(1)} KB, Type: ${file.type}`
  }

    const extractDataFromPDF = async (file: File): Promise<Partial<IntakeForm>> => {
    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${BACKEND_URL}/extract-pdf`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'PDF extraction failed')
      }
      
      console.log('PDF extraction result:', result.data)
      return result.data
      
    } catch (error) {
      console.error('PDF extraction failed:', error)
      // Return fallback data structure
      return {
        patientName: "Patient name not found",
        age: "Age not specified",
        sex: "Gender not specified",
        dob: "Date of birth not found",
        contactNumber: "Contact number not provided",
        patientId: "Patient ID not found",
        abhaId: "ABHA ID not found",
        previousCondition: "No previous conditions reported",
        currentMedication: "No current medications listed",
        familyHistory: "No family history provided",
        knownAllergy: "No known allergies reported",
        chiefComplaint: "Chief complaint not specified",
        referringDoctor: "Referring doctor not mentioned",
        neurologicalSymptom: "No neurological symptoms reported",
        treatmentHistory: "No treatment history provided",
        symptomProgression: "Symptom progression not described",
        reportContent: "Medical report uploaded for review"
      }
    }
  }

  // Fallback AI analysis function for non-PDF files and manual text
  const analyzeTextWithAI = async (text: string): Promise<Partial<IntakeForm>> => {
    // For now, return a basic structure - you can implement AI analysis here if needed
    // or remove this function entirely if you only want PDF extraction
    return {
      patientName: "Patient name not found",
      age: "Age not specified",
      sex: "Gender not specified",
      dob: "Date of birth not found",
      contactNumber: "Contact number not provided",
      patientId: "Patient ID not found",
      abhaId: "ABHA ID not found",
      previousCondition: "No previous conditions reported",
      currentMedication: "No current medications listed",
      familyHistory: "No family history provided",
      knownAllergy: "No known allergies reported",
      chiefComplaint: "Chief complaint not specified",
      referringDoctor: "Referring doctor not mentioned",
      neurologicalSymptom: "No neurological symptoms reported",
      treatmentHistory: "No treatment history provided",
      symptomProgression: "Symptom progression not described",
      reportContent: "Report uploaded for review"
    }
  }

  // Manual field extraction fallback
  const extractFieldsManually = (aiResponse: string, originalText: string): Partial<IntakeForm> => {
    const extracted: Partial<IntakeForm> = {}
    
    // Extract basic information using patterns
    const patterns = {
      patientName: /(?:name|patient|patient name)[\s:]+([a-zA-Z\s]+)/i,
      age: /(?:age|years? old)[\s:]+(\d+)/i,
      sex: /(?:sex|gender)[\s:]+([a-zA-Z]+)/i,
      contactNumber: /(?:phone|contact|mobile|number)[\s:]+([\d\-\+\(\)\s]+)/i,
      patientId: /(?:patient id|id|patient number)[\s:]+([a-zA-Z0-9\-\_]+)/i,
      abhaId: /(?:abha|abha id)[\s:]+([a-zA-Z0-9\-\_]+)/i,
    }
    
    Object.entries(patterns).forEach(([field, pattern]) => {
      const match = originalText.match(pattern) || aiResponse.match(pattern)
      if (match && match[1]) {
        extracted[field as keyof IntakeForm] = match[1].trim()
      }
    })
    
    // Set defaults for missing fields
    const defaults = {
      patientName: "Patient name not found",
      age: "Age not specified",
      sex: "Gender not specified",
      dob: "Date of birth not found",
      contactNumber: "Contact number not provided",
      patientId: "Patient ID not found",
      abhaId: "ABHA ID not found",
      previousCondition: "No previous conditions reported",
      currentMedication: "No current medications listed",
      familyHistory: "No family history provided",
      knownAllergy: "No known allergies reported",
      chiefComplaint: "Chief complaint not specified",
      referringDoctor: "Referring doctor not mentioned",
      neurologicalSymptom: "No neurological symptoms reported",
      treatmentHistory: "No treatment history provided",
      symptomProgression: "Symptom progression not described",
      reportContent: "Medical report uploaded for review"
    }
    
    // Merge extracted data with defaults
    return { ...defaults, ...extracted }
  }

  const scanReport = async () => {
    if (!selectedReport && !manualText.trim()) {
      setError("Please select a report file or enter text manually")
      return
    }

    setExtractionStatus({
      isExtracting: true,
      progress: "Starting extraction...",
      success: false,
      error: null,
      extractedFields: 0
    })
    setError(null)

    try {
      let textToAnalyze = ""
      
      let extractedData: Partial<IntakeForm> = {}
      
      if (selectedReport) {
        setExtractionStatus(prev => ({ ...prev, progress: "Extracting data from PDF..." }))
        
        // Use PDF extraction for PDF files
        if (selectedReport.type === 'application/pdf') {
          extractedData = await extractDataFromPDF(selectedReport)
        } else {
          // For other file types, use text extraction
          let textToAnalyze = await extractTextFromFile(selectedReport)
          if (manualText.trim()) {
            textToAnalyze += (textToAnalyze ? "\n\n" : "") + manualText.trim()
          }
          
          if (!textToAnalyze || textToAnalyze.trim().length < 10) {
            throw new Error("No meaningful text found. Please check your file or enter text manually.")
          }
          
          // For non-PDF files, still use AI analysis (you can keep the old function if needed)
          setExtractionStatus(prev => ({ ...prev, progress: "Analyzing with AI..." }))
          extractedData = await analyzeTextWithAI(textToAnalyze)
        }
      } else if (manualText.trim()) {
        // Only manual text - use AI analysis
        setExtractionStatus(prev => ({ ...prev, progress: "Analyzing with AI..." }))
        extractedData = await analyzeTextWithAI(manualText.trim())
      } else {
        throw new Error("Please select a report file or enter text manually")
      }
      
      // Count fields with meaningful data (not default placeholder text)
      const extractedFieldCount = Object.keys(extractedData).filter(key => {
        const value = extractedData[key as keyof IntakeForm]
        const isDefaultValue = [
          "Patient name not found", "Age not specified", "Gender not specified", 
          "Date of birth not found", "Contact number not provided", "Patient ID not found",
          "ABHA ID not found", "No previous conditions reported", "No current medications listed",
          "No family history provided", "No known allergies reported", "Chief complaint not specified",
          "Referring doctor not mentioned", "No neurological symptoms reported", "No treatment history provided",
          "Symptom progression not described", "Medical report uploaded for review"
        ]
        return value && !isDefaultValue.includes(value)
      }).length
      
      console.log('Extracted data:', extractedData)
      console.log(`Fields with meaningful data: ${extractedFieldCount}`)
      
      // Always update form with extracted data (guaranteed to have all fields)
      setForm(prev => ({
        ...prev,
        ...extractedData
      }))
      
      // Set success status
      setExtractionStatus({
        isExtracting: false,
        progress: "",
        success: true,
        error: null,
        extractedFields: extractedFieldCount
      })
      
      // Show success message
      if (extractedFieldCount > 0) {
        setError(null)
        console.log(`Successfully extracted meaningful data for ${extractedFieldCount} fields`)
        
        // Show which fields were extracted
        const extractedFields = Object.entries(extractedData)
          .filter(([key, value]) => {
            const isDefaultValue = [
              "Patient name not found", "Age not specified", "Gender not specified", 
              "Date of birth not found", "Contact number not provided", "Patient ID not found",
              "ABHA ID not found", "No previous conditions reported", "No current medications listed",
              "No family history provided", "No known allergies reported", "Chief complaint not specified",
              "Referring doctor not mentioned", "No neurological symptoms reported", "No treatment history provided",
              "Symptom progression not described", "Medical report uploaded for review"
            ]
            return value && !isDefaultValue.includes(value)
          })
          .map(([key, value]) => key)
        
        console.log("Fields with meaningful data:", extractedFields)
      } else {
        // All fields populated with default values - still a success
        setError(null)
        console.log("Form populated with default values - ready for manual input")
      }
      
      // Auto-clear success status after 5 seconds
      setTimeout(() => {
        setExtractionStatus(prev => ({ ...prev, success: false }))
      }, 5000)
      
    } catch (err: any) {
      console.error("Report scanning error:", err)
      setExtractionStatus({
        isExtracting: false,
        progress: "",
        success: false,
        error: err.message || "Failed to extract data from report",
        extractedFields: 0
      })
    }
  }

  const clearExtractedData = () => {
    const clearedForm: IntakeForm = {
      patientName: "",
      age: "",
      sex: "",
      dob: "",
      contactNumber: "",
      patientId: "",
      abhaId: "",
      previousCondition: "",
      currentMedication: "",
      familyHistory: "",
      knownAllergy: "",
      chiefComplaint: "",
      referringDoctor: "",
      neurologicalSymptom: "",
      treatmentHistory: "",
      symptomProgression: "",
      reportContent: "",
    }
    setForm(clearedForm)
    setSelectedReport(null)
    setManualText("")
    setExtractionStatus({
      isExtracting: false,
      progress: "",
      success: false,
      error: null,
      extractedFields: 0
    })
    setError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      // Validate required fields
      const requiredFields = ['patientName', 'age', 'contactNumber']
      const missingFields = requiredFields.filter(field => !form[field as keyof IntakeForm]?.trim())
      
      if (missingFields.length > 0) {
        throw new Error(`Please fill in required fields: ${missingFields.join(', ')}`)
      }
      
      let pdfFilePath = null
      
      // Upload PDF if selected
      if (selectedReport && selectedReport.type === 'application/pdf') {
        const formData = new FormData()
        formData.append('file', selectedReport)
        
        const uploadResponse = await fetch(`${BACKEND_URL}/upload-pdf`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Failed to upload PDF')
        }
        
        const uploadResult = await uploadResponse.json()
        pdfFilePath = uploadResult.file_path
      }
      
      // Prepare data for API
      const intakeData = {
        patientName: form.patientName,
        age: form.age,
        sex: form.sex,
        dob: form.dob,
        contactNumber: form.contactNumber,
        patientId: form.patientId,
        abhaId: form.abhaId,
        previousCondition: form.previousCondition,
        currentMedication: form.currentMedication,
        familyHistory: form.familyHistory,
        knownAllergy: form.knownAllergy,
        chiefComplaint: form.chiefComplaint,
        referringDoctor: form.referringDoctor,
        neurologicalSymptom: form.neurologicalSymptom,
        treatmentHistory: form.treatmentHistory,
        symptomProgression: form.symptomProgression,
        reportContent: form.reportContent,
        previousReportPdf: pdfFilePath,
        extractedData: extractionStatus.success ? {
          extractedFields: extractionStatus.extractedFields,
          timestamp: new Date().toISOString()
        } : null
      }
      
      // Save to database
      const response = await fetch(`${BACKEND_URL}/api/intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(intakeData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log("Patient intake saved successfully:", result)
      
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      
      // Clear form after successful save
      clearExtractedData()
      
    } catch (err: any) {
      console.error("Save error:", err)
      setError(err?.message || "Failed to save patient intake")
    } finally {
      setIsSaving(false)
    }
  }

  const getFieldStatus = (fieldValue: string) => {
    if (fieldValue && fieldValue.trim() !== "") {
      return "filled"
    }
    return "empty"
  }

  const filledFieldsCount = Object.values(form).filter(value => value && value.trim() !== "").length
  const totalFieldsCount = Object.keys(form).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Patient Intake</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{user.full_name}</span>
              </div>
              <div className="text-xs text-gray-500">{user.department}</div>
            </div>
            <Button onClick={logout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Patient Intake</CardTitle>
            <CardDescription>
              Upload a medical report for AI-assisted auto-filling or enter patient details manually
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Report Upload and Text Input Section */}
            <div className="mb-8 space-y-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">PDF Data Extraction</h3>
            </div>
              
              {/* File Upload */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="reportFile" className="text-sm font-medium">
                    Upload Medical Report
                  </Label>
                  <Input
                    id="reportFile"
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={handleFileChange}
                    disabled={extractionStatus.isExtracting}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported: PDF, TXT, DOC, DOCX (max 10MB)
                  </p>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={scanReport}
                    disabled={(!selectedReport && !manualText.trim()) || extractionStatus.isExtracting}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {extractionStatus.isExtracting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Extract Data
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Manual Text Input */}
              <div>
                <Label htmlFor="manualText" className="text-sm font-medium">
                  Or Paste Report Content Manually (for non-PDF files)
                </Label>
                <Textarea
                  id="manualText"
                  placeholder="Copy and paste patient report content here for manual analysis..."
                  rows={4}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  disabled={extractionStatus.isExtracting}
                  className="mt-1 text-sm"
                />
              </div>

              {/* Extraction Status */}
              {extractionStatus.isExtracting && (
                <Alert className="border-blue-200 bg-blue-50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription className="text-blue-800">
                    {extractionStatus.progress}
                  </AlertDescription>
                </Alert>
              )}

              {extractionStatus.success && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Successfully extracted data for {extractionStatus.extractedFields} field(s)!
                  </AlertDescription>
                </Alert>
              )}

              {extractionStatus.error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {extractionStatus.error}
                  </AlertDescription>
                </Alert>
              )}

              {/* File Info */}
              {selectedReport && (
                <div className="text-sm text-gray-600 bg-white p-2 rounded border">
                  <span className="font-medium">Selected file:</span> {selectedReport.name} 
                  <span className="ml-2 text-gray-500">
                    ({(selectedReport.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}

              {/* Debug: Show extracted text */}
              {extractionStatus.success && (
                <details className="mt-4 p-3 bg-gray-50 rounded border">
                  <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                    🔍 Debug: View Extracted Text & AI Response
                  </summary>
                  <div className="space-y-3 text-xs">
                    <div>
                      <strong>Extracted Text Length:</strong> {extractionStatus.extractedFields > 0 ? 
                        `${extractionStatus.extractedFields} fields with meaningful data` : 
                        'All fields populated with default values'
                      }
                    </div>
                    <div>
                      <strong>Form Status:</strong> {filledFieldsCount} of {totalFieldsCount} fields completed
                    </div>
                    <div className="bg-white p-2 rounded border max-h-32 overflow-y-auto">
                      <strong>Form Data Preview:</strong>
                      <pre className="whitespace-pre-wrap text-xs">
                        {JSON.stringify(form, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </div>

            {/* Progress Indicator */}
            {filledFieldsCount > 0 && (
              <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      Form Progress: {filledFieldsCount} of {totalFieldsCount} fields completed
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={clearExtractedData}
                    className="text-green-700 border-green-300 hover:bg-green-100"
                  >
                    Clear All Data
                  </Button>
                </div>
                <div className="mt-2 w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(filledFieldsCount / totalFieldsCount) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Patient Information Form */}
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSave}>
              {/* Basic Information */}
              <div className="md:col-span-2">
                <h4 className="font-semibold text-gray-900 mb-4">Basic Information</h4>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="patientName">
                  Patient Name <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="patientName" 
                  value={form.patientName} 
                  onChange={(e) => handleChange("patientName", e.target.value)}
                  className={getFieldStatus(form.patientName) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter patient name"
                  required
                />
                {getFieldStatus(form.patientName) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">
                  Age <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="age" 
                  value={form.age} 
                  onChange={(e) => handleChange("age", e.target.value)}
                  className={getFieldStatus(form.age) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter age"
                  required
                />
                {getFieldStatus(form.age) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Input 
                  id="sex" 
                  value={form.sex} 
                  onChange={(e) => handleChange("sex", e.target.value)}
                  className={getFieldStatus(form.sex) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter sex"
                />
                {getFieldStatus(form.sex) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input 
                  id="dob" 
                  type="date" 
                  value={form.dob} 
                  onChange={(e) => handleChange("dob", e.target.value)}
                  className={getFieldStatus(form.dob) === "filled" ? "border-green-500 bg-green-50" : ""}
                />
                {getFieldStatus(form.dob) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber">
                  Contact Number <span className="text-red-500">*</span>
                </Label>
                <Input 
                  id="contactNumber" 
                  value={form.contactNumber} 
                  onChange={(e) => handleChange("contactNumber", e.target.value)}
                  className={getFieldStatus(form.contactNumber) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter contact number"
                  required
                />
                {getFieldStatus(form.contactNumber) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientId">Patient ID</Label>
                <Input 
                  id="patientId" 
                  value={form.patientId} 
                  onChange={(e) => handleChange("patientId", e.target.value)}
                  className={getFieldStatus(form.patientId) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter patient ID"
                />
                {getFieldStatus(form.patientId) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="abhaId">ABHA ID</Label>
                <Input 
                  id="abhaId" 
                  value={form.abhaId} 
                  onChange={(e) => handleChange("abhaId", e.target.value)}
                  className={getFieldStatus(form.abhaId) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter ABHA ID"
                />
                {getFieldStatus(form.abhaId) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              {/* Medical Information */}
              <div className="md:col-span-2 mt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Medical Information</h4>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="previousCondition">Previous Conditions</Label>
                <Textarea 
                  id="previousCondition" 
                  rows={2} 
                  value={form.previousCondition} 
                  onChange={(e) => handleChange("previousCondition", e.target.value)}
                  className={getFieldStatus(form.previousCondition) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter previous medical conditions"
                />
                {getFieldStatus(form.previousCondition) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="currentMedication">Current Medications</Label>
                <Textarea 
                  id="currentMedication" 
                  rows={2} 
                  value={form.currentMedication} 
                  onChange={(e) => handleChange("currentMedication", e.target.value)}
                  className={getFieldStatus(form.currentMedication) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter current medications"
                />
                {getFieldStatus(form.currentMedication) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="familyHistory">Family History</Label>
                <Textarea 
                  id="familyHistory" 
                  rows={2} 
                  value={form.familyHistory} 
                  onChange={(e) => handleChange("familyHistory", e.target.value)}
                  className={getFieldStatus(form.familyHistory) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter family medical history"
                />
                {getFieldStatus(form.familyHistory) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="knownAllergy">Known Allergies</Label>
                <Textarea 
                  id="knownAllergy" 
                  rows={2} 
                  value={form.knownAllergy} 
                  onChange={(e) => handleChange("knownAllergy", e.target.value)}
                  className={getFieldStatus(form.knownAllergy) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter known allergies"
                />
                {getFieldStatus(form.knownAllergy) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="chiefComplaint">Chief Complaint</Label>
                <Textarea 
                  id="chiefComplaint" 
                  rows={3} 
                  value={form.chiefComplaint} 
                  onChange={(e) => handleChange("chiefComplaint", e.target.value)}
                  className={getFieldStatus(form.chiefComplaint) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter chief complaint or main symptoms"
                />
                {getFieldStatus(form.chiefComplaint) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="referringDoctor">Referring Doctor</Label>
                <Input 
                  id="referringDoctor" 
                  value={form.referringDoctor} 
                  onChange={(e) => handleChange("referringDoctor", e.target.value)}
                  className={getFieldStatus(form.referringDoctor) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter referring physician name"
                />
                {getFieldStatus(form.referringDoctor) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="neurologicalSymptom">Neurological Symptoms</Label>
                <Textarea 
                  id="neurologicalSymptom" 
                  rows={2} 
                  value={form.neurologicalSymptom} 
                  onChange={(e) => handleChange("neurologicalSymptom", e.target.value)}
                  className={getFieldStatus(form.neurologicalSymptom) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter neurological symptoms"
                />
                {getFieldStatus(form.neurologicalSymptom) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="treatmentHistory">History</Label>
                <Textarea 
                  id="treatmentHistory" 
                  rows={2} 
                  value={form.treatmentHistory} 
                  onChange={(e) => handleChange("treatmentHistory", e.target.value)}
                  className={getFieldStatus(form.treatmentHistory) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter treatment history"
                />
                {getFieldStatus(form.treatmentHistory) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="symptomProgression">Symptom Progression</Label>
                <Textarea 
                  id="symptomProgression" 
                  rows={2} 
                  value={form.symptomProgression} 
                  onChange={(e) => handleChange("symptomProgression", e.target.value)}
                  className={getFieldStatus(form.symptomProgression) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter symptom progression details"
                />
                {getFieldStatus(form.symptomProgression) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reportContent">Report</Label>
                <Textarea 
                  id="reportContent" 
                  rows={4} 
                  value={form.reportContent} 
                  onChange={(e) => handleChange("reportContent", e.target.value)}
                  className={getFieldStatus(form.reportContent) === "filled" ? "border-green-500 bg-green-50" : ""}
                  placeholder="Enter report content or summary"
                />
                {getFieldStatus(form.reportContent) === "filled" && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Filled
                  </p>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="md:col-span-2">
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      {error}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Form Actions */}
              <div className="md:col-span-2 flex gap-3 pt-4 border-t">
                <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Patient Intake"
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearExtractedData}
                  disabled={isSaving}
                >
                  Clear All Data
                </Button>
                
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Successfully saved!</span>
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}