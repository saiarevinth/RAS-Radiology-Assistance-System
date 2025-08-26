import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    let oldReport, newReport;
    
    try {
      const body = await request.json();
      oldReport = body.oldReport;
      newReport = body.newReport;
    } catch (jsonErr) {
      console.error('Failed to parse JSON body:', jsonErr);
      return NextResponse.json({ 
        error: 'Invalid JSON body', 
        details: String(jsonErr) 
      }, { status: 400 });
    }
    
    if (!oldReport || !newReport) {
      return NextResponse.json({ 
        error: "Both old and new reports are required." 
      }, { status: 400 });
    }

    // Call the Python script with the text content directly
    return new Promise((resolve) => {
      const py = spawn("python", ["backend/compare_reports.py"], {
        env: process.env,
      });

      let result = "";
      let error = "";
      
      py.stdout.on("data", (data) => {
        result += data.toString();
      });
      
      py.stderr.on("data", (data) => {
        error += data.toString();
        console.error('Python stderr:', data.toString());
      });
      
      py.on("close", (code) => {
        if (code !== 0) {
          return resolve(
            NextResponse.json({ 
              error: "Comparison failed", 
              details: error || `Python script exited with code ${code}`,
              exitCode: code 
            }, { status: 500 })
          );
        }
        
        try {
          const parsed = JSON.parse(result);
          resolve(NextResponse.json(parsed));
        } catch (e) {
          console.error('Failed to parse comparison output:', e, 'Raw output:', result);
          resolve(NextResponse.json({ 
            error: "Failed to process comparison results", 
            details: String(e), 
            raw: result 
          }, { status: 500 }));
        }
      });
      
      // Send the text content to the Python script
      py.stdin.write(JSON.stringify({ 
        oldReport, 
        newReport 
      }));
      py.stdin.end();
    });
  } catch (err: any) {
    console.error('POST /api/compare-reports failed:', err);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: String(err) 
    }, { status: 500 });
  }
}
