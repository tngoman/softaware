#!/bin/bash
###############################################################################
#  Staff Chat — End-to-End API Test Suite v2
#  Tests ALL phases from BACKEND_PLAN.md (144 tasks)
###############################################################################

BASE="http://localhost:8787/api/staff-chat"
AUTH_BASE="http://localhost:8787/api/auth"

TOKEN1=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'admin-softaware-001'},'change_me_to_a_long_random_string_please',{expiresIn:'2h'}))")
TOKEN2=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({userId:'1e850371-0d9a-42c3-b5d6-4daeb7c7e2f3'},'change_me_to_a_long_random_string_please',{expiresIn:'2h'}))")

USER1="admin-softaware-001"
USER2="1e850371-0d9a-42c3-b5d6-4daeb7c7e2f3"

PASS=0; FAIL=0; WARN=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

check() {
  local name="$1" exp="$2" got="$3" body="$4"
  if [ "$got" == "$exp" ]; then
    echo -e "  ${GREEN}✅${NC} $name (HTTP $got)"
    PASS=$((PASS+1))
  elif [ -n "$5" ] && [ "$got" == "$5" ]; then
    echo -e "  ${GREEN}✅${NC} $name (HTTP $got — alt OK)"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌${NC} $name (want $exp, got $got)"
    [ -n "$body" ] && echo -e "     ${YELLOW}$(echo "$body" | head -c 300)${NC}"
    ERRORS="${ERRORS}\n  ❌ $name (want $exp, got $got)"
    FAIL=$((FAIL+1))
  fi
}

section() { echo -e "\n${CYAN}${BOLD}━━━ $1 ━━━${NC}"; }

api() {
  local method="$1" path="$2" token="$3" data="$4"
  if [ "$method" == "GET" ] || [ "$method" == "DELETE" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE}${path}" -H "Authorization: Bearer $token")
  else
    RESP=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE}${path}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  BODY=$(echo "$RESP" | sed '$d')
  CODE=$(echo "$RESP" | tail -1)
}

auth_api() {
  local method="$1" path="$2" token="$3" data="$4"
  if [ "$method" == "GET" ] || [ "$method" == "DELETE" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X "$method" "${AUTH_BASE}${path}" -H "Authorization: Bearer $token")
  else
    RESP=$(curl -s -w "\n%{http_code}" -X "$method" "${AUTH_BASE}${path}" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  BODY=$(echo "$RESP" | sed '$d')
  CODE=$(echo "$RESP" | tail -1)
}

extract() {
  echo "$BODY" | node -e "
    process.stdin.resume();let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{
        const j=JSON.parse(d);
        const paths='$1'.split('||');
        for(const p of paths){
          const v=p.split('.').reduce((o,k)=>o&&o[k],j);
          if(v!==undefined&&v!==null){console.log(v);return}
        }
        console.log('')
      }catch(e){console.log('')}
    })" 2>/dev/null
}

###############################################################################
section "PHASE 1 — Core Chat Foundation"
###############################################################################

echo -e "\n${BOLD}Conversations CRUD${NC}"

api GET "/conversations" "$TOKEN1"
check "GET /conversations" "200" "$CODE" "$BODY"

# Create DM
api POST "/conversations" "$TOKEN1" "{\"type\":\"direct\",\"member_ids\":[\"$USER2\"]}"
DM_ID=$(extract "data.conversation.id||data.id")
check "POST /conversations — DM" "201" "$CODE" "$BODY" "200"
echo -e "     DM ID: ${YELLOW}$DM_ID${NC}"

# Create group
GRP_NAME="E2E-$(date +%s)"
api POST "/conversations" "$TOKEN1" "{\"type\":\"group\",\"name\":\"$GRP_NAME\",\"member_ids\":[\"$USER2\"]}"
GRP_ID=$(extract "data.conversation.id||data.id")
check "POST /conversations — group" "201" "$CODE" "$BODY" "200"
echo -e "     Group ID: ${YELLOW}$GRP_ID${NC}"

# Get conversation detail
if [ -n "$DM_ID" ]; then
  api GET "/conversations/$DM_ID" "$TOKEN1"
  check "GET /conversations/:id — DM detail" "200" "$CODE" "$BODY"
fi
if [ -n "$GRP_ID" ]; then
  api GET "/conversations/$GRP_ID" "$TOKEN1"
  check "GET /conversations/:id — group detail" "200" "$CODE" "$BODY"
fi

# Update group
if [ -n "$GRP_ID" ]; then
  api PUT "/conversations/$GRP_ID" "$TOKEN1" '{"name":"E2E Updated"}'
  check "PUT /conversations/:id — rename group" "200" "$CODE" "$BODY"
fi

# Filter by type
api GET "/conversations?type=direct" "$TOKEN1"
check "GET /conversations?type=direct" "200" "$CODE" "$BODY"
api GET "/conversations?type=group" "$TOKEN1"
check "GET /conversations?type=group" "200" "$CODE" "$BODY"

echo -e "\n${BOLD}Members Management${NC}"

if [ -n "$GRP_ID" ]; then
  THIRD="b607d05e-14d0-11f1-b2eb-0050565f79aa"
  api POST "/conversations/$GRP_ID/members" "$TOKEN1" "{\"user_ids\":[\"$THIRD\"]}"
  check "POST /members — add member" "200" "$CODE" "$BODY" "201"

  api PATCH "/conversations/$GRP_ID/members/me" "$TOKEN1" '{"pinned":true}'
  check "PATCH /members/me — pin" "200" "$CODE" "$BODY"

  api PATCH "/conversations/$GRP_ID/members/me" "$TOKEN1" '{"muted_until":"2099-12-31 23:59:59"}'
  check "PATCH /members/me — mute" "200" "$CODE" "$BODY"

  api PATCH "/conversations/$GRP_ID/members/me" "$TOKEN1" '{"muted_until":null}'
  check "PATCH /members/me — unmute" "200" "$CODE" "$BODY"

  api PATCH "/conversations/$GRP_ID/members/me" "$TOKEN1" '{"archived":true}'
  check "PATCH /members/me — archive" "200" "$CODE" "$BODY"

  api PATCH "/conversations/$GRP_ID/members/me" "$TOKEN1" '{"archived":false,"pinned":false}'
  check "PATCH /members/me — unarchive+unpin" "200" "$CODE" "$BODY"
fi

echo -e "\n${BOLD}Messages CRUD${NC}"

if [ -n "$DM_ID" ]; then
  api POST "/conversations/$DM_ID/messages" "$TOKEN1" '{"content":"Hello from E2E!","message_type":"text"}'
  MSG1=$(extract "data.message.id||data.id")
  check "POST /messages — send text" "201" "$CODE" "$BODY" "200"

  api POST "/conversations/$DM_ID/messages" "$TOKEN1" '{"content":"Second E2E msg","message_type":"text"}'
  MSG2=$(extract "data.message.id||data.id")
  check "POST /messages — second msg" "201" "$CODE" "$BODY" "200"

  api POST "/conversations/$DM_ID/messages" "$TOKEN1" "{\"content\":\"A reply\",\"message_type\":\"text\",\"reply_to_id\":$MSG1}"
  MSG_REPLY=$(extract "data.message.id||data.id")
  check "POST /messages — reply" "201" "$CODE" "$BODY" "200"

  api GET "/conversations/$DM_ID/messages?limit=10" "$TOKEN1"
  check "GET /messages — paginated" "200" "$CODE" "$BODY"

  api PUT "/conversations/$DM_ID/messages/$MSG1" "$TOKEN1" '{"content":"Hello edited!"}'
  check "PUT /messages/:id — edit" "200" "$CODE" "$BODY"

  api POST "/conversations/$DM_ID/read" "$TOKEN1" "{\"message_id\":$MSG1}"
  check "POST /conversations/:id/read — mark read" "200" "$CODE" "$BODY"
fi

if [ -n "$GRP_ID" ]; then
  api POST "/conversations/$GRP_ID/messages" "$TOKEN1" '{"content":"Group E2E msg","message_type":"text"}'
  GRP_MSG=$(extract "data.message.id||data.id")
  check "POST /messages — group msg" "201" "$CODE" "$BODY" "200"
fi

echo -e "\n${BOLD}Search${NC}"

api GET "/search?q=E2E" "$TOKEN1"
check "GET /search?q=E2E — global" "200" "$CODE" "$BODY"

if [ -n "$DM_ID" ]; then
  api GET "/conversations/$DM_ID/search?q=Hello" "$TOKEN1"
  check "GET /conversations/:id/search — in-conv" "200" "$CODE" "$BODY"
fi

echo -e "\n${BOLD}Media & Profile${NC}"

if [ -n "$DM_ID" ]; then
  api GET "/conversations/$DM_ID/media" "$TOKEN1"
  check "GET /conversations/:id/media" "200" "$CODE" "$BODY"
fi

api GET "/users/$USER2/profile" "$TOKEN1"
check "GET /users/:id/profile" "200" "$CODE" "$BODY"

api GET "/users/available" "$TOKEN1"
check "GET /users/available — DM picker" "200" "$CODE" "$BODY"

###############################################################################
section "PHASE 2 — Rich Media"
###############################################################################

echo -e "\n${BOLD}Link Preview & GIFs${NC}"

api GET "/link-preview?url=https://github.com" "$TOKEN1"
check "GET /link-preview" "200" "$CODE" "$BODY"

api GET "/gifs?q=hello" "$TOKEN1"
check "GET /gifs?q=hello" "200" "$CODE" "$BODY"

echo -e "\n${BOLD}File Upload${NC}"

if [ -n "$DM_ID" ]; then
  B64=$(echo -n "E2E test file content" | base64)
  api POST "/conversations/$DM_ID/upload" "$TOKEN1" "{\"file_data\":\"data:text/plain;base64,$B64\",\"file_name\":\"e2e_test.txt\"}"
  check "POST /upload — file" "200" "$CODE" "$BODY" "201"
fi

###############################################################################
section "PHASE 3 — Notifications & Sync"
###############################################################################

echo -e "\n${BOLD}DND Controls${NC}"

api GET "/dnd" "$TOKEN1"
check "GET /dnd" "200" "$CODE" "$BODY"

api PUT "/dnd" "$TOKEN1" '{"enabled":true,"start":"22:00","end":"07:00"}'
check "PUT /dnd — enable" "200" "$CODE" "$BODY"

api PUT "/dnd" "$TOKEN1" '{"enabled":false}'
check "PUT /dnd — disable" "200" "$CODE" "$BODY"

echo -e "\n${BOLD}Notification Sound${NC}"

if [ -n "$DM_ID" ]; then
  api PUT "/conversations/$DM_ID/notification-sound" "$TOKEN1" '{"sound":"chime"}'
  check "PUT /notification-sound" "200" "$CODE" "$BODY"
fi

echo -e "\n${BOLD}Sync${NC}"

SINCE=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
api GET "/sync?since=$SINCE" "$TOKEN1"
check "GET /sync" "200" "$CODE" "$BODY"

###############################################################################
section "PHASE 4 — Advanced Messaging"
###############################################################################

echo -e "\n${BOLD}Reactions${NC}"

if [ -n "$MSG1" ]; then
  api POST "/messages/$MSG1/reactions" "$TOKEN1" '{"emoji":"👍"}'
  check "POST /reactions — add" "200" "$CODE" "$BODY" "201"

  api GET "/messages/$MSG1/reactions" "$TOKEN1"
  check "GET /reactions" "200" "$CODE" "$BODY"

  api POST "/messages/$MSG1/reactions" "$TOKEN1" '{"emoji":"👍"}'
  check "POST /reactions — toggle off" "200" "$CODE" "$BODY" "201"
fi

echo -e "\n${BOLD}Forward${NC}"

if [ -n "$MSG2" ] && [ -n "$GRP_ID" ]; then
  api POST "/messages/$MSG2/forward" "$TOKEN1" "{\"conversation_ids\":[$GRP_ID]}"
  check "POST /forward" "200" "$CODE" "$BODY" "201"
fi

echo -e "\n${BOLD}Starred Messages${NC}"

if [ -n "$MSG1" ]; then
  api POST "/messages/$MSG1/star" "$TOKEN1"
  check "POST /star — star" "200" "$CODE" "$BODY" "201"

  api GET "/starred" "$TOKEN1"
  check "GET /starred" "200" "$CODE" "$BODY"

  api POST "/messages/$MSG1/star" "$TOKEN1"
  check "POST /star — unstar" "200" "$CODE" "$BODY" "201"
fi

echo -e "\n${BOLD}Report Message${NC}"

if [ -n "$MSG2" ]; then
  api POST "/messages/$MSG2/report" "$TOKEN1" '{"reason":"E2E test — ignore"}'
  check "POST /report" "200" "$CODE" "$BODY" "201"
fi

###############################################################################
section "PHASE 5 — Voice & Video Calling"
###############################################################################

echo -e "\n${BOLD}ICE Config${NC}"

api GET "/calls/ice-config" "$TOKEN1"
check "GET /calls/ice-config" "200" "$CODE" "$BODY"

echo -e "\n${BOLD}Call API${NC}"

api GET "/calls/history" "$TOKEN1"
check "GET /calls/history" "200" "$CODE" "$BODY"

if [ -n "$DM_ID" ]; then
  api POST "/calls/initiate" "$TOKEN1" "{\"conversation_id\":$DM_ID,\"call_type\":\"voice\"}"
  CALL_ID=$(extract "data.call.id||data.callId||data.id")
  check "POST /calls/initiate — voice" "200" "$CODE" "$BODY" "201"
  echo -e "     Call ID: ${YELLOW}$CALL_ID${NC}"

  if [ -n "$CALL_ID" ]; then
    api GET "/calls/$CALL_ID" "$TOKEN1"
    check "GET /calls/:id — detail" "200" "$CODE" "$BODY"

    api POST "/calls/$CALL_ID/end" "$TOKEN1" '{}'
    check "POST /calls/:id/end" "200" "$CODE" "$BODY"
  fi
fi

echo -e "\n${BOLD}Scheduled Calls${NC}"

if [ -n "$GRP_ID" ]; then
  SCHED_TIME=$(date -u -d '+1 hour' '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u '+%Y-%m-%d %H:%M:%S')
  api POST "/scheduled-calls" "$TOKEN1" "{\"conversation_id\":$GRP_ID,\"call_type\":\"video\",\"title\":\"E2E Meeting\",\"scheduled_at\":\"$SCHED_TIME\"}"
  SCHED_ID=$(extract "data.scheduledCall.id||data.id||data.call.id")
  check "POST /scheduled-calls — create" "200" "$CODE" "$BODY" "201"
  echo -e "     Scheduled ID: ${YELLOW}$SCHED_ID${NC}"

  api GET "/scheduled-calls" "$TOKEN1"
  check "GET /scheduled-calls" "200" "$CODE" "$BODY"

  if [ -n "$SCHED_ID" ]; then
    api GET "/scheduled-calls/$SCHED_ID" "$TOKEN1"
    check "GET /scheduled-calls/:id" "200" "$CODE" "$BODY"

    api DELETE "/scheduled-calls/$SCHED_ID" "$TOKEN1"
    check "DELETE /scheduled-calls/:id" "200" "$CODE" "$BODY"
  fi
fi

###############################################################################
section "PHASE 6 — Management & Polish"
###############################################################################

echo -e "\n${BOLD}Clear Conversation${NC}"

if [ -n "$GRP_ID" ]; then
  api POST "/conversations/$GRP_ID/clear" "$TOKEN1" '{}'
  check "POST /clear conversation" "200" "$CODE" "$BODY"
fi

echo -e "\n${BOLD}WebAuthn / Biometric${NC}"

auth_api POST "/webauthn/register-options" "$TOKEN1" '{}'
check "POST /webauthn/register-options" "200" "$CODE" "$BODY"

auth_api GET "/webauthn/credentials" "$TOKEN1"
check "GET /webauthn/credentials" "200" "$CODE" "$BODY"

echo -e "\n${BOLD}Session Management${NC}"

auth_api GET "/sessions" "$TOKEN1"
check "GET /auth/sessions" "200" "$CODE" "$BODY"

###############################################################################
section "AUTHORIZATION & EDGE CASES"
###############################################################################

echo -e "\n${BOLD}Auth Rejection${NC}"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/conversations")
CODE=$(echo "$RESP" | tail -1)
check "No token → 401" "401" "$CODE"

RESP=$(curl -s -w "\n%{http_code}" "$BASE/conversations" -H "Authorization: Bearer bad_token")
CODE=$(echo "$RESP" | tail -1)
check "Bad token → 401" "401" "$CODE"

echo -e "\n${BOLD}Not Found${NC}"

api GET "/conversations/00000000-0000-0000-0000-000000000000" "$TOKEN1"
check "Non-existent conv → 403/404" "404" "$CODE" "$BODY" "403"

echo -e "\n${BOLD}Permission Check${NC}"

if [ -n "$MSG1" ] && [ -n "$DM_ID" ]; then
  api PUT "/conversations/$DM_ID/messages/$MSG1" "$TOKEN2" '{"content":"Hacked!"}'
  if [ "$CODE" == "403" ] || [ "$CODE" == "400" ] || [ "$CODE" == "404" ]; then
    echo -e "  ${GREEN}✅${NC} User2 cannot edit User1's msg (HTTP $CODE)"
    PASS=$((PASS+1))
  else
    echo -e "  ${RED}❌${NC} SECURITY: User2 edited User1's msg! (HTTP $CODE)"
    ERRORS="${ERRORS}\n  ❌ SECURITY: User2 could edit User1's message"
    FAIL=$((FAIL+1))
  fi
fi

###############################################################################
section "CLEANUP"
###############################################################################

if [ -n "$DM_ID" ] && [ -n "$MSG_REPLY" ]; then
  api DELETE "/conversations/$DM_ID/messages/$MSG_REPLY?forEveryone=true" "$TOKEN1"
  check "DELETE msg — for everyone" "200" "$CODE" "$BODY"
fi

if [ -n "$DM_ID" ] && [ -n "$MSG1" ]; then
  api DELETE "/conversations/$DM_ID/messages/$MSG1" "$TOKEN1"
  check "DELETE msg — for me" "200" "$CODE" "$BODY"
fi

if [ -n "$GRP_ID" ]; then
  api DELETE "/conversations/$GRP_ID/members/$THIRD" "$TOKEN1"
  check "DELETE /members/:userId" "200" "$CODE" "$BODY" "204"
fi

if [ -n "$GRP_ID" ]; then
  api DELETE "/conversations/$GRP_ID" "$TOKEN1"
  check "DELETE /conversations/:id" "200" "$CODE" "$BODY"
fi

###############################################################################
section "SOCKET.IO CONNECTIVITY"
###############################################################################

SOCKET_RESULT=$(cd /var/opt/backend && timeout 10 node -e "
const {io}=require('/var/opt/frontend/node_modules/socket.io-client');
const s=io('http://localhost:8787/chat',{auth:{token:'$TOKEN1'},transports:['websocket'],timeout:5000});
s.on('connect',()=>{console.log('OK:'+s.id);s.disconnect();process.exit(0)});
s.on('connect_error',e=>{console.log('FAIL:'+e.message);process.exit(1)});
setTimeout(()=>{console.log('TIMEOUT');process.exit(1)},8000);
" 2>/dev/null)
if [[ "$SOCKET_RESULT" == OK:* ]]; then
  echo -e "  ${GREEN}✅${NC} Socket.IO /chat — connected (${SOCKET_RESULT#OK:})"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}❌${NC} Socket.IO /chat — $SOCKET_RESULT"
  ERRORS="${ERRORS}\n  ❌ Socket.IO: $SOCKET_RESULT"
  FAIL=$((FAIL+1))
fi

SOCKET_EVT=$(cd /var/opt/backend && timeout 10 node -e "
const {io}=require('/var/opt/frontend/node_modules/socket.io-client');
const s=io('http://localhost:8787/chat',{auth:{token:'$TOKEN1'},transports:['websocket'],timeout:5000});
s.on('connect',()=>{s.emit('typing',{conversationId:'$DM_ID'});setTimeout(()=>{s.emit('stop-typing',{conversationId:'$DM_ID'});console.log('OK');s.disconnect();process.exit(0)},300)});
s.on('connect_error',e=>{console.log('FAIL:'+e.message);process.exit(1)});
setTimeout(()=>process.exit(1),8000);
" 2>/dev/null)
if [[ "$SOCKET_EVT" == "OK" ]]; then
  echo -e "  ${GREEN}✅${NC} Socket.IO events — typing/stop-typing"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}❌${NC} Socket.IO events — $SOCKET_EVT"
  ERRORS="${ERRORS}\n  ❌ Socket.IO events: $SOCKET_EVT"
  FAIL=$((FAIL+1))
fi

###############################################################################
section "DATABASE TABLE VERIFICATION"
###############################################################################

DB_CHECK=$(cd /var/opt/backend && node -e "
const mysql=require('mysql2/promise');
(async()=>{
  const c=await mysql.createConnection({host:'127.0.0.1',user:'softaware',password:'softaware',database:'softaware',port:3306});
  const [rows]=await c.query('SHOW TABLES');
  const tables=rows.map(r=>Object.values(r)[0]);
  const need=['conversations','conversation_members','messages','message_status','message_reactions','starred_messages','deleted_messages','user_presence','call_sessions','call_participants','webauthn_credentials','user_sessions','scheduled_calls','scheduled_call_participants'];
  for(const t of need){console.log(tables.includes(t)?'OK:'+t:'MISSING:'+t)}
  await c.end();
})().catch(e=>console.log('DB_ERR:'+e.message));
" 2>/dev/null)

while IFS= read -r line; do
  if [[ "$line" == OK:* ]]; then
    echo -e "  ${GREEN}✅${NC} Table: ${line#OK:}"
    PASS=$((PASS+1))
  elif [[ "$line" == MISSING:* ]]; then
    echo -e "  ${RED}❌${NC} Missing: ${line#MISSING:}"
    ERRORS="${ERRORS}\n  ❌ Missing table: ${line#MISSING:}"
    FAIL=$((FAIL+1))
  elif [[ "$line" == DB_ERR:* ]]; then
    echo -e "  ${RED}❌${NC} DB error: ${line#DB_ERR:}"
    FAIL=$((FAIL+1))
  fi
done <<< "$DB_CHECK"

###############################################################################
section "RESULTS"
###############################################################################

TOTAL=$((PASS+FAIL))
echo ""
echo -e "  ${GREEN}✅ Passed: $PASS${NC}"
echo -e "  ${RED}❌ Failed: $FAIL${NC}"
echo -e "  ${BOLD}Total: $TOTAL tests${NC}"
RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc 2>/dev/null || echo "?")
echo -e "  ${BOLD}Pass Rate: ${RATE}%${NC}"

if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}${BOLD}FAILURES:${NC}"
  echo -e "$ERRORS"
fi
echo ""
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}${BOLD}🎉 ALL TESTS PASSED!${NC}"
else
  echo -e "${RED}${BOLD}⚠️  SOME TESTS FAILED${NC}"
fi
