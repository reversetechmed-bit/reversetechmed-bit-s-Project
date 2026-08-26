export async function ensureJsonApiResponse(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("json")) return response;

  await response.body?.cancel();
  return new Response(JSON.stringify([{
    error: {
      json: {
        message: response.status === 404 ? "مسار الخدمة غير موجود. أعد تحميل النظام وحاول مرة أخرى." : "تعذر الوصول إلى خدمة المخزن. أعد المحاولة بعد لحظات.",
        code: -32603,
        data: { code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", httpStatus: response.status },
      },
    },
  }]), {
    status: response.status || 500,
    headers: { "content-type": "application/json" },
  });
}
