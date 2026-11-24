// The single place the frontend talks to the backend. Every request goes through here, so the
// session cookie and the request verification header (CSRF protection) are always sent.

export class ApiRequestError extends Error {
  readonly httpStatusCode: number;

  constructor(httpStatusCode: number, errorMessage: string) {
    super(errorMessage);
    this.httpStatusCode = httpStatusCode;
  }
}

const VERIFICATION_HEADERS = { "X-Requested-With": "Kushlof" };

async function readErrorMessage(httpResponse: Response): Promise<string> {
  try {
    const errorBody = await httpResponse.json();
    if (typeof errorBody.detail === "string") return errorBody.detail;
    if (Array.isArray(errorBody.detail)) {
      return errorBody.detail.map((problem: { msg: string }) => problem.msg).join(", ");
    }
  } catch {
    // Not JSON; use the generic message below.
  }
  return `Request failed (${httpResponse.status}).`;
}

async function sendRequest(apiPath: string, requestInit: RequestInit): Promise<Response> {
  const httpResponse = await fetch(`/api${apiPath}`, { credentials: "same-origin", ...requestInit });
  if (!httpResponse.ok) {
    throw new ApiRequestError(httpResponse.status, await readErrorMessage(httpResponse));
  }
  return httpResponse;
}

export async function sendJsonRequest<ResponseBody>(
  apiPath: string,
  requestOptions: { method?: string; jsonBody?: unknown } = {},
): Promise<ResponseBody> {
  const httpResponse = await sendRequest(apiPath, {
    method: requestOptions.method ?? "GET",
    headers: { "Content-Type": "application/json", ...VERIFICATION_HEADERS },
    body: requestOptions.jsonBody === undefined ? undefined : JSON.stringify(requestOptions.jsonBody),
  });
  if (httpResponse.status === 204) return undefined as ResponseBody;
  return (await httpResponse.json()) as ResponseBody;
}

export async function uploadFile<ResponseBody>(apiPath: string, fileToUpload: File): Promise<ResponseBody> {
  const formData = new FormData();
  formData.append("uploaded_file", fileToUpload);
  const httpResponse = await sendRequest(apiPath, { method: "POST", headers: VERIFICATION_HEADERS, body: formData });
  return (await httpResponse.json()) as ResponseBody;
}

export async function downloadFile(apiPath: string, fallbackFileName: string): Promise<void> {
  const httpResponse = await sendRequest(apiPath, { method: "GET", headers: VERIFICATION_HEADERS });
  const contentDisposition = httpResponse.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(contentDisposition)?.[1] ?? fallbackFileName;
  const fileUrl = URL.createObjectURL(await httpResponse.blob());
  const downloadLink = document.createElement("a");
  downloadLink.href = fileUrl;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(fileUrl);
}
