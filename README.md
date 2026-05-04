# PSD Stitcher UXP 플러그인 메모

Photoshop에서 여러 PSD 파일을 순서대로 열어 한 문서에 세로로 붙이는 UXP 플러그인입니다.

## 현재 정상 로드되는 위치

UXP Developer Tools에는 아래 manifest를 추가해서 사용합니다.

```text
C:\uxp\psd-stitcher\manifest.json
```

테스트용 최소 플러그인은 아래에 있습니다.

```text
C:\uxp\uxp-min-test\manifest.json
```

## 왜 C:\uxp 로 옮겼나

처음 만든 위치는 아래였습니다.

```text
C:\Users\메이크잇_03\Desktop\fhotohop\Test-i1qm1o
```

그런데 UXP Developer Tools의 workspace 설정 파일에서 한글 사용자 폴더명이 깨져 저장됐습니다.

```text
C:\Users\硫붿씠?...
```

이 상태에서 Photoshop 로그에 아래처럼 찍히며 플러그인이 거절됐습니다.

```text
Plugin rejected - Test-i1qm1o due to invalid object
```

그래서 플러그인 실행본을 한글이 없는 ASCII 경로로 복사했습니다.

```text
C:\uxp\psd-stitcher
```

또 플러그인 ID도 안전하게 영문 소문자 도메인 형식으로 바꿨습니다.

```text
com.makeit.psd-stitcher
```

## Photoshop 설정

Photoshop에서 아래 두 옵션을 확인합니다.

```text
Edit > Preferences > Plug-ins
```

체크할 것:

```text
Enable Developer Mode
Enable Generator
```

변경 후 Photoshop을 완전히 재시작합니다.

커뮤니티에서 같은 오류 문구가 `Enable Generator` 미체크 때문에 발생한 사례가 있었습니다.

```text
Load command failed in App with ID PS
Plugin Load Failed.
Devtools: Failed to load the devtools plugin.
```

## UXP Developer Tools에서 다시 추가하는 방법

1. 기존 `Test-i1qm1o` 행을 체크하고 제거합니다.
2. `Add Plugin`을 누릅니다.
3. 아래 파일을 선택합니다.

```text
C:\uxp\psd-stitcher\manifest.json
```

4. `Load` 또는 `Load & Watch`를 누릅니다.
5. Photoshop의 `Plugins` 메뉴에서 `PSD Stitcher` 패널을 엽니다.

## 빌드/수정 원본

개발 원본은 기존 폴더에 남아 있습니다.

```text
C:\Users\메이크잇_03\Desktop\fhotohop\Test-i1qm1o
```

수정 후 빌드는 원본 폴더에서 실행합니다.

```powershell
npm run build
```

빌드 결과는 원본 폴더의 `dist`에 생성됩니다.

```text
C:\Users\메이크잇_03\Desktop\fhotohop\Test-i1qm1o\dist
```

Photoshop에서 로드할 실행본을 갱신하려면 `dist` 내용을 다시 복사합니다.

```powershell
Copy-Item -Path "C:\Users\메이크잇_03\Desktop\fhotohop\Test-i1qm1o\dist\*" -Destination "C:\uxp\psd-stitcher" -Recurse -Force
```

## 현재 manifest 핵심

```json
{
  "id": "com.makeit.psd-stitcher",
  "name": "PSD Stitcher",
  "manifestVersion": 5,
  "host": {
    "app": "PS",
    "minVersion": "27.6.0"
  }
}
```

## 현재 기능

- 여러 PSD/PSB 파일 선택
- 파일명 기준 자동 정렬
- 드래그 또는 버튼으로 순서 조정
- 간격(px) 지정
- 원본 PSD 탭 닫기 옵션
- 선택한 순서대로 새 Photoshop 문서에 세로 병합

## UI 구현 메모

- UXP/Photoshop 패널에서 HTML `<button>` 태그는 Photoshop 네이티브 버튼 스타일을 강하게 탑니다.
- 이 영향으로 CSS의 `font-size`를 `9px`, `5px`, `!important`로 지정해도 실제 화면에서는 글자 크기가 거의 변하지 않을 수 있습니다.
- 실제 테스트에서 `<button>`에 `font-size: 5px !important`를 줬는데도 화면에서는 약 11px처럼 보였습니다.
- 해결 방식은 `<button>` 대신 `div role="button"` 기반의 커스텀 버튼 컴포넌트(`ControlButton`)를 사용하는 것입니다.
- 현재 `파일`, `설정`, `PSD 파일 열기`, `이름순 정렬`, `합치기 실행`, 순서 이동 화살표는 모두 `.control-button` 커스텀 버튼을 사용합니다.
- 커스텀 버튼 전환 후 `font-size: 5px` 테스트에서 글자가 매우 작게 표시되어 CSS 적용이 정상 동작함을 확인했습니다.
- 현재 버튼/탭 폰트 크기는 `9px`입니다.
- 한글 폰트는 돋움처럼 보이는 폴백을 피하기 위해 `"Adobe Clean", "Segoe UI", "Malgun Gothic", sans-serif` 순서로 지정했습니다.

## 다음 개선 후보

- 병합 후 PSD 저장 버튼
- 가로 병합 모드
- 파일명 정렬 규칙 UI
- PSD 크기/해상도 불일치 경고
- 패널 아이콘 재추가
