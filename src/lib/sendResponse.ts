import { Response } from "express";
import { BackendResponse, BackendError } from "../custom";

export function sendErrorResponse(res: Response, err: BackendError) {
  if ("simple" in err) {
    res.status(err.simple.code).json({ simpleError: err.simple.message } as BackendResponse)
  } else if ("complex" in err) {
    res.status(err.complex.code).json({ complexError: err.complex.object } as BackendResponse)
  } else {
    res.status(500).json({ unknownError: err.unknown } as BackendResponse)
  }
}

export function sendSuccessResponse(res: Response, success: any, code?: number) {
  res.json({ success: success, code: code } as BackendResponse)
}