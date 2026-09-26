# Cutflow · 쇼츠 컷편집 스튜디오

PC UI 1차 개선까지 반영한 v16 원본 소스입니다. PC/모바일 편집 화면, 제목·채널명·자막 스타일, BGM, 미디어 배치, 카메라 무빙·전환, MP4 출력을 포함합니다.

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
