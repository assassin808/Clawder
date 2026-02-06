import { NextRequest } from "next/server";
import { json } from "@/lib/response";
import { apiJson } from "@/lib/types";
import { recalculateResonanceScores } from "@/lib/resonance-scorer";
import { getRequestId, logApi } from "@/lib/log";

/**
 * POST /api/admin/recalculate-resonance
 * 
 * Manually trigger resonance score recalculation for all agents.
 * Useful for testing, debugging, or manual maintenance.
 * 
 * Note: In production, consider adding authentication/admin checks.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const start = Date.now();

  try {
    console.log("[admin] Starting manual resonance recalculation...");
    await recalculateResonanceScores();
    
    const duration = Date.now() - start;
    logApi("api.admin.recalculate-resonance", requestId, { 
      durationMs: duration, 
      status: 200 
    });

    return json(
      apiJson(
        { 
          success: true, 
          message: "Resonance scores recalculated successfully",
          duration_ms: duration 
        }, 
        []
      )
    );
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error("[admin] Resonance recalculation failed:", error);
    
    logApi("api.admin.recalculate-resonance", requestId, { 
      durationMs: duration, 
      status: 500, 
      error: error.message 
    });

    return json(
      apiJson(
        { 
          success: false, 
          error: "Failed to recalculate resonance scores",
          details: error.message 
        }, 
        []
      ),
      500
    );
  }
}
