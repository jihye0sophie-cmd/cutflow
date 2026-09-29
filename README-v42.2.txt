Cutflow v42.2 - 모바일 UI 통일성 복원

변경 목표
- PC와 동일한 Cutflow 다크 + 노란색 포인트(#F5E642)
- 별도 'v42 MOBILE' 브랜딩 제거
- 모바일 UI는 PC 엔진을 그대로 호출하되 화면만 모바일용으로 단순화
- 기존 PC 편집 기능/엔진 수정 없음

모바일 구조
1. 상단: Cutflow / 열기 / 저장 / 내보내기
2. Sticky 미리보기 + 재생 + 이전/다음 장면
3. 장면 썸네일 스트립 + 전체 장면 보기
4. 하단 5탭: 자막 / 미디어 / 내레이션 / 템플릿 / BGM

내레이션 탭
- 쇼츠 자동 세팅을 최상단 QUICK START로 항상 표시
- 영상 제목 / 채널명 / 템플릿 / 대본 / 자막 자동 줄바꿈
- 내레이션 / 그리드 이미지 / 개별 이미지 / BGM 선택
- 자동세팅 무음컷 강도
- 그리드 열/행/분할 여백 설정
- 대본 장면 수 / 이미지 수 / 매칭 상태
- 쇼츠 자동 세팅 시작
- 기존 대본/TXT/내레이션/무음컷/자막 구간 만들기 유지

미디어 탭 순서
- 이미지·영상
- 움직임·진입 전환
- 장면 편집
- 상세 설정(Scale / Position X,Y / Trim / 원음 / Fade)

GitHub 교체 파일
- index.html
- mobile-v42.js
- mobile-v42.css
- test-mobile-v42.cjs (회귀 테스트)

GitHub Summary
fix: restore unified Cutflow mobile UI in v42.2

검증
- node --check mobile-v42.js 통과
- test-mobile-v42.cjs 통과
- 전체 소스에서 build.cjs 실행 및 dist 생성 통과
