import { Response } from "express";
import { BackendResponse, BackendError } from "../custom";

export function sendErrorResponse(res: Response, err: BackendError) {
  if ("simpleError" in err) {
    res.status(err.code).json(err as BackendResponse)
  } else if ("complexError" in err) {
    res.status(err.code).json(err as BackendResponse)
  } else {
    res.status(500).json(err as BackendResponse)
  }
}

export function sendSuccessResponse(res: Response, success: any, code?: number) {
  res.json({ success: success, code: code } as BackendResponse)
}