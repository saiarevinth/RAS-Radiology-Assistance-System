"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, LogIn, Mail, Lock, User, Info, Shield, Stethoscope } from "lucide-react"
import { useAuth } from "@/components/AuthContext"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/"
  const { user, loading, refreshAuth } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCredentials, setShowCredentials] = useState(false)
  const [loginAttempts, setLoginAttempts] = useState(0)

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace(redirect)
    }
  }, [loading, user, router, redirect])

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

  // Don't render login form if already authenticated
  if (user) {
    return null
  }

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic rate limiting
    if (loginAttempts >= 5) {
      setError("Too many login attempts. Please wait a moment before trying again.")
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      console.log("Attempting login with:", { email, password: "***" })
      
      const resp = await fetch(`${BACKEND_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      
      console.log("Login response status:", resp.status)
      console.log("Login response headers:", Object.fromEntries(resp.headers.entries()))
      
      const data = await resp.json().catch(() => ({}))
      console.log("Login response data:", data)
      
      if (!resp.ok) {
        setLoginAttempts(prev => prev + 1)
        throw new Error(data?.error || `HTTP ${resp.status}`)
      }
      
      // Reset login attempts on success
      setLoginAttempts(0)
      
      console.log("Login successful, refreshing auth state...")
      
      // Add a small delay to ensure cookie is set
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Refresh authentication state
      await refreshAuth()
      
      console.log("Auth refreshed, redirecting to:", redirect)
      
      // Redirect to the intended page after successful login
      router.replace(redirect)
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err?.message || "Failed to sign in")
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickLogin = (email: string, password: string) => {
    setEmail(email)
    setPassword(password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Hospital Staff Login</h1>
          </div>
          <p className="text-gray-600">Authorized medical staff only</p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <LogIn className="h-5 w-5" /> Doctor Authentication
            </CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@hospital.com"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || loginAttempts >= 5}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" /> Sign In
                  </>
                )}
              </Button>
            </form>

            {error && (
              <Alert className="mt-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            {loginAttempts > 0 && (
              <p className="text-xs text-orange-600 mt-2">
                Login attempts: {loginAttempts}/5
              </p>
            )}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <Shield className="inline h-3 w-3 mr-1" />
                Your session is secured with HttpOnly cookies and encrypted tokens.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-4 w-4" /> Authorized Doctors
            </CardTitle>
            <CardDescription>Available test accounts for system access</CardDescription>
          </CardHeader>
          <CardContent>
            <Collapsible open={showCredentials} onOpenChange={setShowCredentials}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  {showCredentials ? "Hide" : "Show"} Doctor Credentials
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                <div className="text-sm space-y-3">
                  {/* Doctor 1 */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Dr. John Smith</span>
                      <Badge variant="secondary" className="text-xs">Radiology</Badge>
                    </div>
                    <div className="text-blue-700 text-xs space-y-1">
                      <div>Email: dr.smith@hospital.com</div>
                      <div>Password: Smith2024!</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 w-full"
                      onClick={() => handleQuickLogin("dr.smith@hospital.com", "Smith2024!")}
                    >
                      Use This Account
                    </Button>
                  </div>

                  {/* Doctor 2 */}
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900">Dr. Sarah Johnson</span>
                      <Badge variant="secondary" className="text-xs">Neurology</Badge>
                    </div>
                    <div className="text-green-700 text-xs space-y-1">
                      <div>Email: dr.johnson@hospital.com</div>
                      <div>Password: Johnson2024!</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 w-full"
                      onClick={() => handleQuickLogin("dr.johnson@hospital.com", "Johnson2024!")}
                    >
                      Use This Account
                    </Button>
                  </div>

                  {/* Doctor 3 */}
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-900">Dr. Michael Williams</span>
                      <Badge variant="secondary" className="text-xs">Oncology</Badge>
                    </div>
                    <div className="text-purple-700 text-xs space-y-1">
                      <div>Email: dr.williams@hospital.com</div>
                      <div>Password: Williams2024!</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 w-full"
                      onClick={() => handleQuickLogin("dr.williams@hospital.com", "Williams2024!")}
                    >
                      Use This Account
                    </Button>
                  </div>

                  {/* Doctor 4 */}
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-orange-900">Dr. Emily Brown</span>
                      <Badge variant="secondary" className="text-xs">Cardiology</Badge>
                    </div>
                    <div className="text-orange-700 text-xs space-y-1">
                      <div>Email: dr.brown@hospital.com</div>
                      <div>Password: Brown2024!</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 w-full"
                      onClick={() => handleQuickLogin("dr.brown@hospital.com", "Brown2024!")}
                    >
                      Use This Account
                    </Button>
                  </div>

                  {/* Doctor 5 */}
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-900">Dr. Robert Davis</span>
                      <Badge variant="secondary" className="text-xs">Emergency</Badge>
                    </div>
                    <div className="text-red-700 text-xs space-y-1">
                      <div>Email: dr.davis@hospital.com</div>
                      <div>Password: Davis2024!</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 w-full"
                      onClick={() => handleQuickLogin("dr.davis@hospital.com", "Davis2024!")}
                    >
                      Use This Account
                    </Button>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600">
                    <Stethoscope className="inline h-3 w-3 mr-1" />
                    These are test credentials for authorized medical staff. In production, only verified hospital personnel should have access.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


