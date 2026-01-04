/**
 * Backend API Client
 * Utility functions to call the .NET backend API
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T | null;
  errors?: string[] | null;
  timestamp: string;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

export interface ReceiptInfoDto {
  senderName?: string;
  senderAddress?: string;
  receiverName?: string;
  receiverAddress?: string;
  amount: number;
  amountInWords?: string;
  reason?: string;
  location?: string;
  date?: string;
  customFields?: Record<string, string>;
}

export interface ContractMetadataDto {
  contractNumber?: string;
  location?: string;
  contractDate?: string;
}

export interface SignerDto {
  role: string;
  name: string;
  email: string;
}

export interface SignatureDataDto {
  type: string; // "draw" or "type"
  data: string;
  fontFamily?: string;
  color?: string;
}

export interface SignatureResponseDto {
  id: string;
  signerId: string;
  signerRole: string;
  signerName?: string;
  signerEmail?: string;
  signatureData: SignatureDataDto;
  signedAt: string;
}

export interface SignerResponseDto {
  id: string;
  role: string;
  name: string;
  email: string;
}

export type DocumentType = 'Receipt' | 'Contract';
export type DocumentStatus = 'Pending' | 'PartiallySigned' | 'Signed';
export type SigningMode = 'Public' | 'RequiredLogin';

export interface HashVerificationDto {
  isValid: boolean;
  message?: string;
  mismatchedSignatures?: string[];
}

export interface DocumentResponseDto {
  id: string;
  type: DocumentType;
  title?: string;
  content?: string;
  status: DocumentStatus;
  signingMode: SigningMode;
  receiptInfo?: ReceiptInfoDto;
  metadata?: ContractMetadataDto;
  creator?: UserDto;
  signers: SignerResponseDto[]; // Danh sách người cần ký (với tên)
  signatures: SignatureResponseDto[]; // Danh sách chữ ký đã ký
  createdAt: string;
  signedAt?: string;
  viewedAt?: string;
  pdfUrl?: string;
  pdfSignatureBlocks?: PdfSignatureBlockDto[];
  hashVerification?: HashVerificationDto;
}

export interface PaginatedResponseDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateDocumentRequestDto {
  type: DocumentType;
  title?: string;
  content?: string;
  receiptInfo?: ReceiptInfoDto;
  metadata?: ContractMetadataDto;
  signers: SignerDto[];
  signingMode?: SigningMode;
}

export interface UpdateDocumentRequestDto {
  title?: string;
  content?: string;
  receiptInfo?: ReceiptInfoDto;
  metadata?: ContractMetadataDto;
  signingMode?: SigningMode;
}

export interface SignDocumentRequestDto {
  signerId: string;
  signerRole?: string;
  signerName?: string;
  signerEmail?: string;
  signatureData: SignatureDataDto;
  // Client IP and User-Agent for accurate audit trail
  clientIpAddress?: string;
  clientUserAgent?: string;
}

export interface SendInvitationRequestDto {
  documentId: string;
  customerEmail: string;
  customerName: string;
  signingUrl: string;
}

export interface UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  documentCount: number;
}

/**
 * Get auth token from cookies (for server-side)
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    // Client-side: cookies are automatically sent
    return null;
  }
  
  // Server-side: need to read from cookies
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return cookieStore.get('jwt_token')?.value || null;
}

/**
 * Extract client IP from request headers
 */
export function getClientIpFromHeaders(headers: Headers): string {
  // Try X-Forwarded-For first (from reverse proxy)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',');
    if (ips.length > 0) {
      return ips[0].trim();
    }
  }
  
  // Try X-Real-IP
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * Get User-Agent from request headers
 */
export function getUserAgentFromHeaders(headers: Headers): string {
  return headers.get('user-agent') || 'unknown';
}

/**
 * Client headers interface for forwarding to backend
 */
export interface ClientHeaders {
  clientIp?: string;
  clientUserAgent?: string;
}

/**
 * Make API request to backend
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  clientHeaders?: ClientHeaders
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Add auth token if available (for server-side)
  if (token && typeof window === 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Forward client IP and User-Agent to backend
  if (clientHeaders?.clientIp) {
    headers['X-Client-IP'] = clientHeaders.clientIp;
  }
  if (clientHeaders?.clientUserAgent) {
    headers['X-Client-User-Agent'] = clientHeaders.clientUserAgent;
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Include cookies for client-side
  });

  // Get response text first (can only be read once)
  let responseText: string;
  try {
    responseText = await response.text();
  } catch (error) {
    throw new Error(`Failed to read response: ${response.statusText}`);
  }

  // Try to parse as JSON
  let data: any;
  const contentType = response.headers.get('content-type');
  const hasJsonContent = contentType?.includes('application/json');
  
  if (hasJsonContent && responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      // If JSON parse fails, use text as error message
      data = { message: responseText || response.statusText };
    }
  } else if (responseText) {
    // Non-JSON response
    data = { message: responseText || response.statusText };
  } else {
    // Empty response
    data = { message: response.statusText || 'Empty response' };
  }

  // If response is not ok, throw error with API message
  if (!response.ok) {
    const errorMessage = data.message || data.errors?.[0] || `API Error: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data;
}

// ==================== Auth APIs ====================

export async function login(email: string, password: string): Promise<ApiResponse<AuthResponseDto>> {
  return apiRequest<AuthResponseDto>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<ApiResponse<AuthResponseDto>> {
  return apiRequest<AuthResponseDto>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export interface VerifyEmailRequestDto {
  email: string;
  otpCode: string;
}

export async function verifyEmail(request: VerifyEmailRequestDto): Promise<ApiResponse<any>> {
  return apiRequest<any>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export async function requestPasswordReset(request: ForgotPasswordRequestDto): Promise<ApiResponse<object>> {
  return apiRequest<object>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export interface ResetPasswordRequestDto {
  email: string;
  token: string;
  newPassword: string;
}

export async function resetPassword(request: ResetPasswordRequestDto): Promise<ApiResponse<object>> {
  return apiRequest<object>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getMe(): Promise<ApiResponse<UserDto>> {
  return apiRequest<UserDto>('/api/auth/me', {
    method: 'GET',
  });
}

export async function logout(): Promise<ApiResponse<object>> {
  return apiRequest<object>('/api/auth/logout', {
    method: 'POST',
  });
}

export interface UpdateProfileRequestDto {
  name?: string;
}

export async function updateProfile(request: UpdateProfileRequestDto): Promise<ApiResponse<UserDto>> {
  return apiRequest<UserDto>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(request: ChangePasswordRequestDto): Promise<ApiResponse<object>> {
  return apiRequest<object>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function requestDeleteAccountOtp(): Promise<ApiResponse<object>> {
  return apiRequest<object>('/api/auth/request-delete-otp', {
    method: 'POST',
  });
}

export async function deleteAccount(otpCode: string): Promise<ApiResponse<object>> {
  return apiRequest<object>('/api/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ otpCode }),
  });
}

// ==================== PDF Document APIs ====================

export interface PdfSignatureBlockDto {
  id: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  signerRole: string;
  isSigned?: boolean;
  signatureId?: string;
}

export interface ApplyPdfSignatureRequestDto {
  signatureBlockId: string;
  signatureImageBase64: string;
  signerName?: string;
  signerEmail?: string;
}

export async function updatePdfSignatureBlocks(documentId: string, signatureBlocks: PdfSignatureBlockDto[]): Promise<ApiResponse<DocumentResponseDto>> {
  return apiRequest<DocumentResponseDto>(`/api/documents/${documentId}/pdf-signature-blocks`, {
    method: 'PUT',
    body: JSON.stringify(signatureBlocks),
  });
}

export async function applyPdfSignature(documentId: string, request: ApplyPdfSignatureRequestDto): Promise<ApiResponse<DocumentResponseDto>> {
  return apiRequest<DocumentResponseDto>(`/api/documents/${documentId}/apply-pdf-signature`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function exportPdfWithSignatures(documentId: string): Promise<Blob> {
  const token = typeof window !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('jwt_token='))?.split('=')[1] || null : await getAuthToken();
  const headers: Record<string, string> = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'}/api/documents/${documentId}/export-pdf`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to export PDF' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return await response.blob();
}

// ==================== Document APIs ====================

export async function createDocument(
  request: CreateDocumentRequestDto
): Promise<ApiResponse<DocumentResponseDto>> {
  return apiRequest<DocumentResponseDto>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getDocuments(params?: {
  status?: DocumentStatus;
  type?: DocumentType;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<PaginatedResponseDto<DocumentResponseDto>>> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.type) queryParams.append('type', params.type);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());

  const query = queryParams.toString();
  return apiRequest<PaginatedResponseDto<DocumentResponseDto>>(
    `/api/documents${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
}

export async function getDocument(
  id: string, 
  clientHeaders?: ClientHeaders
): Promise<ApiResponse<DocumentResponseDto>> {
  return apiRequest<DocumentResponseDto>(`/api/documents/${id}`, {
    method: 'GET',
  }, clientHeaders);
}

export async function updateDocument(
  id: string,
  request: UpdateDocumentRequestDto
): Promise<ApiResponse<DocumentResponseDto>> {
  return apiRequest<DocumentResponseDto>(`/api/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export async function deleteDocument(id: string): Promise<ApiResponse<object>> {
  return apiRequest<object>(`/api/documents/${id}`, {
    method: 'DELETE',
  });
}

export async function signDocument(
  id: string,
  request: SignDocumentRequestDto
): Promise<ApiResponse<DocumentResponseDto>> {
  // Check if we're on server-side or client-side
  const isServerSide = typeof window === 'undefined';
  
  let url: string;
  if (isServerSide) {
    // Server-side: Use absolute URL to call Next.js API route
    // Get base URL from environment or use localhost as fallback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    url = `${baseUrl}/api/documents/${id}/sign`;
  } else {
    // Client-side: Use relative path to call Next.js API route
    url = `/api/documents/${id}/sign`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies
    body: JSON.stringify(request),
  });

  // Get response text first (can only be read once)
  let responseText: string;
  try {
    responseText = await response.text();
  } catch (error) {
    throw new Error(`Failed to read response: ${response.statusText}`);
  }

  // Try to parse as JSON
  let data: any;
  const contentType = response.headers.get('content-type');
  const hasJsonContent = contentType?.includes('application/json');
  
  if (hasJsonContent && responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      // If JSON parse fails, use text as error message
      data = { message: responseText || response.statusText };
    }
  } else if (responseText) {
    // Non-JSON response
    data = { message: responseText || response.statusText };
  } else {
    // Empty response
    data = { message: response.statusText || 'Empty response' };
  }

  // If response is not ok, throw error with API message
  if (!response.ok) {
    const errorMessage = data.message || data.errors?.[0] || `API Error: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data;
}

export async function trackDocumentView(
  id: string, 
  clientHeaders?: ClientHeaders
): Promise<ApiResponse<object>> {
  return apiRequest<object>(`/api/documents/${id}/track-view`, {
    method: 'POST',
  }, clientHeaders);
}

// ==================== Email APIs ====================

export async function sendInvitation(
  request: SendInvitationRequestDto
): Promise<ApiResponse<object>> {
  return apiRequest<object>('/api/email/send-invitation', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ==================== Admin APIs ====================

export async function getUsers(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<ApiResponse<PaginatedResponseDto<UserResponseDto>>> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);

  const query = queryParams.toString();
  return apiRequest<PaginatedResponseDto<UserResponseDto>>(
    `/api/admin/users${query ? `?${query}` : ''}`,
    { method: 'GET' }
  );
}

export async function getUser(id: string): Promise<ApiResponse<UserResponseDto>> {
  return apiRequest<UserResponseDto>(`/api/admin/users/${id}`, {
    method: 'GET',
  });
}

export async function deleteUser(id: string): Promise<ApiResponse<object>> {
  return apiRequest<object>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  });
}

// ==================== Template APIs ====================

export interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  isActive: boolean;
}

export async function getTemplates(category?: string): Promise<ApiResponse<Template[]>> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiRequest<Template[]>(`/api/templates${query}`, {
    method: 'GET',
  });
}

export async function getTemplate(id: string): Promise<ApiResponse<Template>> {
  return apiRequest<Template>(`/api/templates/${id}`, {
    method: 'GET',
  });
}

