'use client';

interface ContactRequest {
  id: string;
  from: string;
  to: string;
  status: string;
  timestamp: number;
}

interface ContactRequestNotificationProps {
  requests: ContactRequest[];
  onApprove: (requestId: string, fromUserId: string) => void;
  onReject: (requestId: string) => void;
}

export default function ContactRequestNotification({
  requests,
  onApprove,
  onReject,
}: ContactRequestNotificationProps) {
  if (requests.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2">
      {requests.map((request) => (
        <div
          key={request.id}
          className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500 animate-slide-in"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xl">👤</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 mb-1">
                連絡先リクエスト
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {request.from}
                </span>
                <br />
                さんから連絡先リクエストが届きました
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(request.id, request.from)}
                  className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold hover:bg-blue-600 transition-colors"
                >
                  承認
                </button>
                <button
                  onClick={() => onReject(request.id)}
                  className="flex-1 bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-bold hover:bg-gray-400 transition-colors"
                >
                  拒否
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
