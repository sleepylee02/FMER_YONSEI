# crawler/yonsei_login_crawl.py
import os, re, json, time, base64
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Dict
import requests
from bs4 import BeautifulSoup
from zoneinfo import ZoneInfo

# --- .env 로딩 (로컬에서만 필요) ---
try:
    from dotenv import load_dotenv  # pip install python-dotenv
    load_dotenv()
except Exception:
    pass

BASE = os.getenv("BASE_URL", "https://space.yonsei.ac.kr")
KST = ZoneInfo("Asia/Seoul")

Y_ID   = (os.getenv("YONSEI_ID") or "").strip()
Y_PW   = (os.getenv("YONSEI_PW") or "").strip()
Y_GOPT = (os.getenv("YONSEI_GOPT") or "A").strip()  # A/B/C/E/D

# Configuration - can be modified directly in code
CAMPUS_LIST = ["SC"]  # 신촌캠퍼스
WEEKS = 1  # 1주간 데이터
START_DATE = None  # None이면 현재 주

S = requests.Session()
S.headers.update({
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
})

def epoch_ms() -> int: return int(time.time()*1000)

def fetch_login_page() -> Dict[str, str]:
    """로그인 페이지에서 keyid, returl, waction 추출"""
    r = S.get(f"{BASE}/index.php?lang=k", timeout=20)
    r.raise_for_status()
    
    soup = BeautifulSoup(r.text, "html.parser")
    form = soup.find("form", {"name": "fflogin"})
    if not form:
        raise RuntimeError("로그인 폼을 찾을 수 없습니다.")
    
    # 모든 hidden input 필드 추출
    hidden_inputs = form.find_all("input", {"type": "hidden"})
    params = {}
    
    for inp in hidden_inputs:
        name = inp.get("name")
        value = inp.get("value", "")
        if name:
            params[name] = value
    
    return params

# ---------- 1) 로그인 ----------
def login() -> bool:
    if not (Y_ID and Y_PW):
        raise RuntimeError("YONSEI_ID / YONSEI_PW 환경변수를 설정하세요.")

    # 혹시 남아있던 쿠키가 있으면 초기화(충돌 방지)
    try:
        S.cookies.clear()
    except Exception:
        pass

    # 로그인 페이지에서 hidden 파라미터들 추출
    meta = fetch_login_page()  # /index.php?lang=k 를 GET해서 fflogin의 hidden 값 파싱
    keyid  = meta.get("keyid")
    returl = meta.get("returl")
    waction = meta.get("waction")
    
    if not (keyid and returl):
        raise RuntimeError("로그인 파라미터(keyid/returl) 추출 실패.")

    # space.yonsei.ac.kr에서 직접 로그인 처리
    # gOpt에 따라 다른 방식으로 로그인
    gopt = Y_GOPT  # A=학부생, B=대학원생, C=교직원, E=동문, D=대관등록단체
    
    if gopt in ["A", "B", "C", "E"]:
        # 포털 연동 로그인 (학부생/대학원생/교직원/동문)
        id_b64 = base64.b64encode(Y_ID.upper().encode("utf-8")).decode("ascii")
        pw_b64 = base64.b64encode(Y_PW.encode("utf-8")).decode("ascii")
        
        login_url = "https://infra.yonsei.ac.kr/lauth/YLLOGIN.do"
        params = {"req_key": keyid, "returl": returl}
        data = {
            "id": id_b64, 
            "pw": pw_b64, 
            "gOpt": gopt,
            "act": "lok"
        }
        
        # waction이 있으면 추가
        if waction:
            data["waction"] = waction
        
        headers = {
            "Referer": f"{BASE}/index.php?lang=k",
            "Origin": "https://space.yonsei.ac.kr",
        }
        
        
        r = S.post(login_url, params=params, data=data,
                   headers=headers, timeout=30, allow_redirects=True)
        r.raise_for_status()
        
        
        
        # 응답에서 오류 메시지 찾기
        response_text = r.text
        if "error" in response_text.lower() or "오류" in response_text or "실패" in response_text or "alert" in response_text.lower():
            print("응답에 오류 메시지가 포함된 것 같습니다.")
            # alert나 script에서 오류 메시지 추출
            import re
            alert_match = re.search(r"alert\s*\(\s*['\"]([^'\"]+)['\"]", response_text)
            if alert_match:
                print(f"Alert 메시지: {alert_match.group(1)}")
            print(f"응답 일부: {response_text[:1000]}...")
        
        # 로그인 성공 시 자동 리다이렉트가 있는지 확인
        if "location.href" in response_text or "window.location" in response_text:
            print("자동 리다이렉트 스크립트가 있습니다.")
            redirect_match = re.search(r"location\.href\s*=\s*['\"]([^'\"]+)['\"]", response_text)
            if redirect_match:
                redirect_url = redirect_match.group(1)
                print(f"리다이렉트 URL: {redirect_url}")
                try:
                    redirect_r = S.get(redirect_url, timeout=30, allow_redirects=True)
                    print(f"리다이렉트 결과: {redirect_r.status_code}, URL: {redirect_r.url}")
                except Exception as e:
                    print(f"리다이렉트 실패: {e}")
        
        # 포털 로그인 성공 시 자동 submit 폼 처리
        if r.url.startswith("https://infra.yonsei.ac.kr") and "document.Chk.submit()" in response_text:
            print("포털 로그인 성공! 자동 제출 폼 발견, 처리 중...")
            
            # BeautifulSoup으로 폼 데이터 추출
            soup = BeautifulSoup(response_text, "html.parser")
            form = soup.find("form", {"name": "Chk"})
            if form:
                action = form.get("action")
                form_data = {}
                
                # hidden input 필드들 추출
                for inp in form.find_all("input", {"type": "hidden"}):
                    name = inp.get("name")
                    value = inp.get("value", "")
                    if name:
                        form_data[name] = value
                
                print(f"인증 폼 제출: {action}")
                print(f"폼 데이터 키들: {list(form_data.keys())}")
                
                # 폼 제출
                auth_r = S.post(action, data=form_data, timeout=30, allow_redirects=True)
                print(f"인증 제출 결과: {auth_r.status_code}, URL: {auth_r.url}")
                
            else:
                print("자동 제출 폼을 찾을 수 없습니다.")
        
    else:
        # 대관등록단체 직접 로그인 (D)
        login_url = f"{BASE}/index.php?mid=K00"
        data = {
            "act": "lok",
            "gOpt": "D", 
            "gid": Y_ID,
            "gpwd": Y_PW
        }
        
        headers = {
            "Referer": f"{BASE}/index.php?lang=k",
            "Origin": "https://space.yonsei.ac.kr",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        r = S.post(login_url, data=data, headers=headers, timeout=30, allow_redirects=True)
        r.raise_for_status()

    # 최종 검증
    return check_logged_in()

def check_logged_in() -> bool:
    r = S.get(f"{BASE}/index.php?mid=K06&lang=k", timeout=20)
    r.raise_for_status()
    t = r.text
    if ("로그아웃" in t) or ("usertab04on" in t):
        return True
    # 로그인 폼이 그대로 보이면 실패
    return False

# ---------- 2) 공용 유틸 ----------
def week_range_kst(anchor: datetime):
    anchor = anchor.astimezone(KST)
    mon = datetime(anchor.year, anchor.month, anchor.day, tzinfo=KST) - timedelta(days=anchor.weekday())
    sun = mon + timedelta(days=6)
    return mon, sun

def to_epoch_utc(dt_kst: datetime) -> int:
    return int(dt_kst.astimezone(timezone.utc).timestamp())

def normalize_event(ev: Dict) -> Dict:
    s = datetime.fromtimestamp(int(ev["start"]), tz=timezone.utc).astimezone(KST)
    e = datetime.fromtimestamp(int(ev["end"]),   tz=timezone.utc).astimezone(KST)
    weekday = ["월","화","수","목","금","토","일"][s.weekday()]
    return {
        "id": ev.get("id"),
        "title": (ev.get("title") or "").strip(),
        "date": s.strftime("%Y-%m-%d"),
        "weekday": weekday,
        "time": f'{s.strftime("%H:%M")} - {e.strftime("%H:%M")}',
        "start": s.isoformat(),
        "end": e.isoformat(),
        "color": ev.get("color"),
        "textColor": ev.get("textColor"),
    }

# ---------- 3) AJAX들 ----------
def get_buildings(campus: str) -> List[Tuple[str, str]]:
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "text/html, */*; q=0.01",
        "Referer": f"{BASE}/index.php?mid=K06&lang=k"
    }
    r = S.post(f"{BASE}/ys_ajax.php",
               data={"mid":"K06","act":"getUserBuilding4","a":campus,"ntime":int(time.time())},
               headers=headers,
               timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    buildings = [(opt.get("value","").strip(), opt.get_text(strip=True))
                for opt in soup.select("option") if opt.get("value")]
    return buildings

def get_rooms(campus: str, building_id: str) -> List[Tuple[str, str]]:
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "text/html, */*; q=0.01",
        "Referer": f"{BASE}/index.php?mid=K06&lang=k"
    }
    r = S.post(f"{BASE}/ys_ajax.php",
               data={"mid":"K06","act":"getUserRoomB","a":campus,"b":building_id,"ntime":int(time.time())},
               headers=headers,
               timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    rooms = [(opt.get("value","").strip(), opt.get_text(strip=True))
            for opt in soup.select("option") if opt.get("value")]
    return rooms

def fetch_events_unix(room_uid: str, week_start_kst: datetime, week_end_kst: datetime) -> List[Dict]:
    start = to_epoch_utc(week_start_kst.replace(hour=0, minute=0, second=0, microsecond=0))
    end   = to_epoch_utc((week_end_kst + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0))
    params = {"mid":"K06","act":"bookingstatus3","uid":room_uid,"start":start,"end":end,"_":epoch_ms()}
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": f"{BASE}/index.php?mid=K06&lang=k",
    }
    r = S.get(f"{BASE}/ys_ajax.php", params=params, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()

# ---------- 4) 메인 ----------
def main():
    print("연세대학교 공간 대관 시스템 크롤링 시작...")
    
    ok = login()
    if not ok:
        raise RuntimeError("로그인 실패 (로그아웃 버튼 미검출).")
    print("✅ 로그인 성공")

    # 대관현황 페이지 방문 (AJAX 요청을 위한 세션 설정)
    calendar_r = S.get(f"{BASE}/index.php?mid=K06&lang=k", timeout=20)
    print("✅ 대관현황 페이지 초기화 완료")

    anchor = datetime.fromisoformat(START_DATE).replace(tzinfo=KST) if START_DATE else datetime.now(KST)
    base_week_start, _ = week_range_kst(anchor)
    print(f"📅 크롤링 기간: {base_week_start.date()} 부터 {WEEKS}주간")

    os.makedirs("../frontend/data", exist_ok=True)
    out_path = "../frontend/data/schedule.jsonl"
    seen = set()
    count = 0
    building_count = 0
    room_count = 0

    with open(out_path, "w", encoding="utf-8") as out:
        for campus in CAMPUS_LIST:
            print(f"\n🏫 캠퍼스: {campus}")
            
            try:
                blds = get_buildings(campus)
                print(f"  건물 {len(blds)}개 발견")
                building_count += len(blds)
            except Exception as e:
                print(f"  ❌ 건물 목록 가져오기 실패: {e}")
                continue
                
            for i, (b_id, b_name) in enumerate(blds):
                print(f"  🏢 [{i+1}/{len(blds)}] {b_name}")
                
                try:
                    rooms = get_rooms(campus, b_id)
                    room_count += len(rooms)
                    print(f"    방 {len(rooms)}개")
                except Exception as e:
                    print(f"    ❌ 방 목록 가져오기 실패: {e}")
                    continue
                
                for j, (r_uid, r_name) in enumerate(rooms):
                    print(f"    📍 [{j+1}/{len(rooms)}] {r_name}")
                    
                    for w in range(WEEKS):
                        week_start = base_week_start + timedelta(days=7*w)
                        week_end   = week_start + timedelta(days=6)
                        try:
                            evs = fetch_events_unix(r_uid, week_start, week_end)
                        except Exception as e:
                            print(f"      ⚠️  이벤트 가져오기 실패: {e}")
                            continue
                            
                        for ev in evs:
                            key = (r_uid, ev.get("start"), ev.get("end"))
                            if key in seen: 
                                continue
                            seen.add(key)
                            row = {
                                "campus": campus,
                                "building_id": b_id,
                                "building_name": b_name,
                                "room_uid": r_uid,
                                "room_name": r_name,
                                **normalize_event(ev),
                            }
                            out.write(json.dumps(row, ensure_ascii=False) + "\n")
                            count += 1
                        time.sleep(0.1)  # 서버 배려
                        
    print(f"\n🎉 크롤링 완료!")
    print(f"   캠퍼스: {len(CAMPUS_LIST)}개")
    print(f"   건물: {building_count}개") 
    print(f"   방: {room_count}개")
    print(f"   이벤트: {count}개")
    print(f"   출력 파일: {out_path}")

def test_login_only():
    """로그인만 테스트하는 함수"""
    print("로그인 테스트 시작...")
    print(f"YONSEI_ID: {Y_ID[:3]}*** (길이: {len(Y_ID)})")
    print(f"YONSEI_PW: {'*' * len(Y_PW)} (길이: {len(Y_PW)})")
    print(f"YONSEI_GOPT: {Y_GOPT}")
    
    try:
        ok = login()
        if ok:
            print("✅ 로그인 성공!")
            return True
        else:
            print("❌ 로그인 실패")
            # 추가 디버깅: 현재 페이지 확인
            r = S.get(f"{BASE}/index.php?mid=K06&lang=k", timeout=20)
            print(f"현재 페이지 제목: {r.text.split('<title>')[1].split('</title>')[0] if '<title>' in r.text else 'N/A'}")
            if "로그인" in r.text:
                print("여전히 로그인 페이지에 있습니다.")
            return False
    except Exception as e:
        print(f"❌ 로그인 중 오류: {e}")
        return False

def test_building_and_rooms():
    """건물 목록과 방 목록 종합 테스트"""
    print("건물 및 방 목록 테스트...")
    try:
        # 먼저 대관현황 페이지 방문 (AJAX 요청을 위한 세션 설정)
        print("대관현황 페이지 방문 중...")
        calendar_r = S.get(f"{BASE}/index.php?mid=K06&lang=k", timeout=20)
        print(f"대관현황 페이지 응답: {calendar_r.status_code}")
        
        # 건물 목록 가져오기
        buildings = get_buildings("SC")
        print(f"✅ 건물 {len(buildings)}개 발견")
        
        # 처음 몇 개 건물의 방 목록 테스트
        test_count = 3
        for i, (b_id, b_name) in enumerate(buildings[:test_count]):
            print(f"\n--- 건물 {i+1}/{test_count}: {b_name} (ID: {b_id}) ---")
            
            try:
                rooms = get_rooms("SC", b_id)
                print(f"✅ 방 {len(rooms)}개 발견:")
                
                # 처음 5개 방만 출력
                for j, (r_uid, r_name) in enumerate(rooms[:5]):
                    print(f"  {j+1}. {r_uid}: {r_name}")
                
                if len(rooms) > 5:
                    print(f"  ... 외 {len(rooms)-5}개")
                
                # 첫 번째 방의 이벤트 데이터 테스트
                if rooms:
                    test_room_uid, test_room_name = rooms[0]
                    print(f"\n첫 번째 방 '{test_room_name}' 이벤트 테스트...")
                    test_calendar_events(test_room_uid, test_room_name)
                    
            except Exception as e:
                print(f"❌ 건물 {b_name} 방 목록 가져오기 실패: {e}")
                continue
                
        return True
        
    except Exception as e:
        print(f"❌ 건물 및 방 목록 테스트 실패: {e}")
        return False

def test_calendar_events(room_uid: str, room_name: str):
    """특정 방의 캘린더 이벤트 테스트"""
    try:
        # 현재 주 계산
        now = datetime.now(KST)
        week_start, week_end = week_range_kst(now)
        
        print(f"  기간: {week_start.date()} ~ {week_end.date()}")
        
        events = fetch_events_unix(room_uid, week_start, week_end)
        print(f"  ✅ 이벤트 {len(events)}개 발견")
        
        # 이벤트 상세 정보 출력
        for i, event in enumerate(events[:3]):  # 처음 3개만
            title = event.get("title", "제목없음")
            start_ts = event.get("start", "")
            end_ts = event.get("end", "")
            
            # 타임스탬프 변환
            if start_ts and end_ts:
                start_dt = datetime.fromtimestamp(int(start_ts), tz=KST)
                end_dt = datetime.fromtimestamp(int(end_ts), tz=KST)
                time_str = f"{start_dt.strftime('%m/%d %H:%M')} - {end_dt.strftime('%H:%M')}"
            else:
                time_str = "시간정보없음"
                
            print(f"    {i+1}. {title} ({time_str})")
            
        if len(events) > 3:
            print(f"    ... 외 {len(events)-3}개")
            
            
    except Exception as e:
        print(f"  ❌ 이벤트 가져오기 실패: {e}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # 테스트 모드
        if test_login_only():
            test_building_and_rooms()
    elif len(sys.argv) > 1 and sys.argv[1] == "rooms":
        # 방 및 이벤트만 테스트 (로그인 이미 된 상태 가정)
        test_building_and_rooms()
    else:
        # 전체 크롤링
        main()
