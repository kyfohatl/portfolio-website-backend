import { Response } from "express";
import { BackendResponse, BackendError } from "../custom";
import { hasMessage, isBackEndError } from "./types/error";

export function sendErrorResponse(res: Response, err?: unknown) {
  const GENERIC_ERROR: BackendError = { unknownError: "Something went wrong!", code: 500 }

  if (!err) return res.status(500).json(GENERIC_ERROR)

  if (isBackEndError(err)) {
    res.status(err.code).json(err)
  } else if (hasMessage(err)) {
    res.status(500).json({ unknownError: err.message, code: 500 } as BackendError)
  } else {
    res.status(500).json(GENERIC_ERROR)
  }
}

export function sendSuccessResponse(res: Response, success: any, code?: number) {
  res.status(code ? code : 200).json({ success: success, code: code } as BackendResponse)
}