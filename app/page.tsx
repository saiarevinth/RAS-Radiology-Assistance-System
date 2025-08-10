"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, Brain, Activity, AlertCircle, CheckCircle } from "lucide-react"
import Image from "next/image"

interface SegmentationResult {
  image_data_uri: string
  affected_percentage: number
}

interface BackendStatus {
  connected: boolean
  message: string
}

export default function RadiologistAssistance() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [modelPath, setModelPath] = useState("ResUNet50.pth")
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<SegmentationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({ connected: false, message: "Not checked" })
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)

  // Backend URL - can be configured via environment variable
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

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

      const response = await fetch(`${BACKEND_URL}/segment`, {
        method: "POST",
        body: formData,
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
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Radiologist Assistance System</h1>
          </div>
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
          {/* Upload Section */}
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

          {/* Results Section */}
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
