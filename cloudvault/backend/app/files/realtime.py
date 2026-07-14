"""
Real-time event delivery over WebSocket. A user opens one socket per
session and receives JSON events as their uploads/processing progress:

  upload_started, upload_progress, upload_completed, file_processed, security_alert

For a single-instance deployment this in-memory ConnectionManager is
sufficient. For horizontal scaling across multiple backend replicas, back
this with Redis Pub/Sub (each instance subscribes to a per-user channel and
relays messages to its local sockets) instead of the in-process dict below.
"""
import json
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.security.jwt_handler import decode_token

router = APIRouter(tags=["Realtime"])


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.active and ws in self.active[user_id]:
            self.active[user_id].remove(ws)
            if not self.active[user_id]:
                del self.active[user_id]

    async def send_event(self, user_id: str, event_type: str, payload: dict):
        for ws in self.active.get(user_id, []):
            await ws.send_text(json.dumps({"event": event_type, "data": payload}))


manager = ConnectionManager()


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = Query(...)):
    """
    Requires a valid access token as a query param (?token=...) whose
    subject matches the path's user_id - both checked BEFORE accept(), so
    an unauthenticated or mismatched connection is rejected at the
    handshake rather than after joining. This closes a real hole: without
    it, anyone could connect as any user_id and receive that user's
    real-time events (upload progress, security alerts, etc).
    """
    try:
        payload = decode_token(token, expected_type="access")
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if payload.get("sub") != user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keepalive / ping from client
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
