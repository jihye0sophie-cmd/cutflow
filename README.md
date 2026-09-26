# v18 업데이트 — 장면별 이미지·영상 크기와 위치

`이미지·영상` 메뉴에 Scale, Position X/Y, 초기화를 추가했습니다. PC/모바일은 같은 컨트롤과 장면 데이터를 사용합니다.

- **Scale**: 10–500%, 기본 100%. 슬라이더 또는 숫자로 조절합니다.
- **Position X/Y**: 이미지가 배치되는 영상 영역의 너비/높이 대비 %, 기본 0. 양수는 오른쪽/아래 방향입니다.
- **미리보기에서 조절**을 켜면 청록색 경계가 표시됩니다. PC는 마우스 드래그, 모바일은 한 손가락 드래그와 두 손가락 핀치로 조절합니다. 조절 모드를 끄면 기존 모바일 스크롤/장면 스와이프를 사용합니다.
- 조절 모드를 켤 때 재생을 일시정지합니다. 재생 중에는 제스처를 비활성화합니다. 전체 화면 미리보기에서도 조절할 수 있습니다.
- **초기화**는 현재 장면만 100% / 0 / 0으로 되돌립니다. 같은 원본 파일을 사용하는 다른 장면에도 독립적인 값을 저장합니다.
- 카메라 무빙은 기본 배율에 곱해집니다. 130% + 줌인의 시작 배율은 130%입니다. 제목·자막·채널명 위치는 변경하지 않습니다.
- 기존 공유 렌더러에서 배율·위치를 처리하므로 MP4에도 동일한 변환이 전달됩니다. 청록색 UI 테두리는 출력되지 않습니다.
- 기존과 같이 프로젝트는 현재 탭 메모리에 유지됩니다. 장면 이동에는 유지되지만 새로고침 후 자동 복원 기능을 추가한 것은 아닙니다.

GitHub 저장소에는 이 폴더의 **내용 전체**를 복사하면 됩니다. 기존 파일 중 변경된 것은 `renderer.js`, `app.js`, `scene-ui.js`, `index.html`, `build.cjs`, `package.json`, `README.md`입니다. 새 파일은 `media-transform.js`, `media-transform.css`, `test-transform.cjs`, `docs/media-transform-review.md`입니다. 기존 자동 장면 생성, 타임라인, 자막, 오디오, 인코더 및 모바일 전체 화면 코드는 그대로 유지했습니다.

검증: `npm test`, `npm run build` 통과. 드래그/핀치는 실제 이벤트 핸들러를 호출하는 모의 DOM 테스트입니다. 브라우저 실행 환경을 준비할 수 없어 실제 iPhone/Android·PC 화면 및 최종 MP4 육안 검수는 수행하지 못했습니다. 자세한 범위는 `docs/media-transform-review.md`를 참고하세요.

---

# Cutflow · 쇼츠 컷편집 스튜디오

PC UI 개선, 모바일 전체 화면 및 장면별 구도 조절을 반영한 v18 원본 소스입니다. PC/모바일 편집 화면, 제목·채널명·자막 스타일, BGM, 미디어 배치, 카메라 무빙·전환, MP4 출력을 포함합니다.

## 먼저 확인

이 패키지는 GitHub 저장소와 앱 제작에 사용할 **웹 앱 원본 소스**입니다. 설치형 Windows/macOS 앱이나 iPhone 앱 파일은 아닙니다. 실제 업로드한 사진·영상·내레이션과 편집 중인 프로젝트 데이터는 포함되지 않습니다. 현재 편집 내용은 탭 메모리에 유지되므로 새로고침 전에 영상을 저장하세요.

## GitHub에 올리기 — GitHub Desktop 권장

1. ZIP을 압축 해제합니다.
2. GitHub Desktop에서 새 저장소를 만들고, 압축 해제한 폴더 **안의 파일과 폴더 전체**를 저장소 폴더로 복사합니다.
3. 저장소 최상위에 `index.html`, `package.json`, `assets/`, `.github/`가 있어야 합니다. ZIP 파일 자체를 업로드하지 마세요.
4. Commit 후 Publish repository를 누릅니다. 기본 브랜치는 `main`을 사용합니다.
5. 웹사이트로도 사용하려면 저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택합니다.
6. Actions에서 Deploy Cutflow to GitHub Pages를 실행하거나 main에 새 커밋을 올립니다. 완료 후 Settings → Pages에 사이트 주소가 표시됩니다.

macOS에서 점으로 시작하는 파일이 보이지 않으면 Command + Shift + . 로 표시합니다. GitHub Desktop을 사용하면 많은 폰트 파일과 인코더 파일도 함께 올리기 편합니다. 공개 저장소는 소스와 내장 파일도 공개됩니다.

## 로컬 실행

Node.js 22.12 이상을 설치한 다음 이 폴더에서 실행합니다.

```sh
npm ci
npm run dev
```

터미널에 출력되는 localhost 주소로 접속합니다. `index.html`을 더블클릭하는 file:// 방식은 폰트·인코더 로딩이 제한되므로 사용하지 마세요.

## 빌드 및 테스트

```sh
npm test
npm run build
npm run preview
```

`dist/`가 완성된 정적 웹 앱입니다. 빌드는 원본 파일과 assets를 그대로 복사하며 영상 엔진을 변경하지 않습니다. 경로는 상대 경로이므로 GitHub Pages 저장소 하위 주소에서도 사용할 수 있습니다. 내장 인코더의 core.part0~3은 모두 필요합니다.

## 앱으로 전환할 때

Electron/Tauri 등 데스크톱 앱 래퍼에서 이 소스 또는 dist를 연결할 수 있습니다. 래퍼·설치 프로그램·앱 서명·자동 업데이트는 이 패키지에 구현되어 있지 않습니다. 앱 제작 시 file:// 대신 안전한 로컬 서버/프로토콜에서 assets, Worker, Blob 및 WebAssembly가 로드되도록 구성하고 Windows/macOS에서 미디어 입력과 MP4 출력을 검수해야 합니다. iOS 앱으로 전환하려면 별도의 앱 프로젝트와 기기 검증이 필요합니다.

## 코드 구조

- app.js: 프로젝트 데이터, 장면·자막 타임라인, 재생과 편집 이벤트
- renderer.js / encoder.js / audio-mixer.js: 캔버스 렌더링, MP4 생성, 오디오 믹싱
- desktop-ui.js/css: PC 전용 화면
- mobile-ui.js/css: 모바일 전용 화면
- scene-ui.js / studio-tokens.css: 공통 장면 UI 연결과 색상
- style-editor.js / caption-style.js / caption-ranges.js: 자막 스타일
- bgm-editor.js: BGM 설정
- assets/: 내장 폰트와 인코더, 관련 라이선스

자동 자막 시간은 기존 대본 분량·무음 구간 기반 추정 방식이며 음성 인식은 아닙니다. 저장/복구나 새로운 무음 삭제 기능은 추가하지 않았습니다.

## 포함된 제3자 구성요소

assets 내부의 LICENSE와 NOTICE를 유지하세요. FFmpeg 및 폰트별 라이선스는 각각 해당 파일을 따릅니다. 이 패키지 전체에 임의의 오픈소스 라이선스를 부여하지 않았습니다.

## 출처와 검수

기준: 배포 버전 16, 소스 커밋 f1a38a4342ba1be08838c4890292e314aca3a357.
편집/렌더링 원본 코드는 그대로 포함하고 GitHub 실행·배포 설정 및 이 안내만 정리했습니다. 기존 브라우저 검수 기록은 docs/pc-ui-review.md에 있습니다. GitHub Actions 배포 및 네이티브 앱 실행은 사용자 저장소/앱 환경에서 별도 확인해야 합니다.

GitHub Pages 공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
