# PSD Stitcher UXP 플러그인 메모

Photoshop에서 여러 PSD 파일을 순서대로 열어 한 문서에 세로로 붙이는 UXP 플러그인입니다.

## 현재 정상 로드되는 위치

UXP Developer Tools에는 아래 manifest를 추가해서 사용합니다.

```text
C:\uxp\psd-stitcher\manifest.json
```

Photoshop/UXP가 직접 읽는 실행본은 `C:\uxp\psd-stitcher`입니다. 바탕화면의 작업 폴더를 수정한 뒤에는 반드시 다시 빌드하고 `dist` 결과물을 이 폴더로 복사한 다음 UXP Developer Tools에서 Reload합니다.

테스트용 최소 플러그인은 아래에 있습니다.

```text
C:\uxp\uxp-min-test\manifest.json
```

## 왜 C:\uxp 로 옮겼나

현재 작업 원본은 바탕화면의 아래 폴더입니다.

```text
C:\Users\메이크잇_03\Desktop\fhotoshop\Test-i1qm1o
```

예전 메모에 남아 있던 `fhotohop` 또는 `fhotshop` 경로는 폴더명 변경 전 경로이거나 오타라서 현재 기준으로는 사용하지 않습니다.

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
5. Photoshop의 `Plugins` 메뉴에서 `fhotoshop` 패널을 엽니다.

## 빌드/수정 원본

개발 원본은 바탕화면의 현재 폴더에 있습니다.

```text
C:\Users\메이크잇_03\Desktop\fhotoshop\Test-i1qm1o
```

수정 후 빌드는 원본 폴더에서 실행합니다.

```powershell
npm run build
```

빌드 결과는 원본 폴더의 `dist`에 생성됩니다.

```text
C:\Users\메이크잇_03\Desktop\fhotoshop\Test-i1qm1o\dist
```

Photoshop에서 로드할 실행본을 갱신하려면 `dist` 내용을 다시 복사합니다.

```powershell
Copy-Item -Path "C:\Users\메이크잇_03\Desktop\fhotoshop\Test-i1qm1o\dist\*" -Destination "C:\uxp\psd-stitcher" -Recurse -Force
```

복사 후에는 UXP Developer Tools에서 해당 플러그인을 Reload합니다.

## 현재 manifest 핵심

```json
{
  "id": "com.makeit.psd-stitcher",
  "name": "fhotoshop",
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
- 마우스 드래그 또는 화살표 버튼으로 순서 조정
- 파일 행 우클릭 메뉴: 목록에서 제거, 맨 위로, 맨 아래로
- 합치기 방향 선택: 세로/가로
- 콘텐츠 사이 간격(px) 지정
- 원본 PSD 탭 닫기 옵션
- 선택한 순서와 합치기 방향대로 새 Photoshop 문서에 병합

## UI 구현 메모

- UXP/Photoshop 패널에서 HTML `<button>` 태그는 Photoshop 네이티브 버튼 스타일을 강하게 탑니다.
- 이 영향으로 CSS의 `font-size`를 `9px`, `5px`, `!important`로 지정해도 실제 화면에서는 글자 크기가 거의 변하지 않을 수 있습니다.
- 실제 테스트에서 `<button>`에 `font-size: 5px !important`를 줬는데도 화면에서는 약 11px처럼 보였습니다.
- 해결 방식은 `<button>` 대신 `div role="button"` 기반의 커스텀 버튼 컴포넌트(`ControlButton`)를 사용하는 것입니다.
- 현재 `파일`, `설정`, `PSD 파일 열기`, `이름순 정렬`, `합치기 실행`, 순서 이동 화살표는 모두 `.control-button` 커스텀 버튼을 사용합니다.
- 커스텀 버튼 전환 후 `font-size: 5px` 테스트에서 글자가 매우 작게 표시되어 CSS 적용이 정상 동작함을 확인했습니다.
- 현재 버튼/탭 폰트 크기는 `9px`입니다.
- 한글 폰트는 돋움처럼 보이는 폴백을 피하기 위해 `"Adobe Clean", "Segoe UI", "Malgun Gothic", sans-serif` 순서로 지정했습니다.
- 리스트 행은 Photoshop 패널에서 기본 드래그 미리보기 흰 박스가 떠서 지저분해지는 문제를 피하려고 HTML native drag/drop 대신 마우스 기반 reorder로 처리합니다.
- 파일 행 구분선은 호버 색상과 같은 계열의 0.5px 라인으로 표시합니다.
- 우클릭 메뉴는 파일명 옆에 작은 삭제 아이콘을 붙이는 방식보다 긴 파일명에서도 레이아웃이 흔들리지 않습니다.

## 현재 합치기 로직

2026-05-06 현재 UI 변경을 제외한 PSD 병합 로직은 Git 기준의 기존 방식으로 되돌려 둔 상태입니다.

- `PSD 파일 열기`는 UXP 파일 선택기를 통해 PSD/PSB 엔트리를 받습니다.
- `합치기 실행`은 하나의 `core.executeAsModal()` 범위 안에서 선택 파일을 순서대로 `app.open(item.entry)`로 엽니다.
- 각 원본 문서의 폭/높이/해상도를 읽어 최종 세로 캔버스 크기를 계산합니다.
- 새 문서를 만든 뒤 각 원본 문서의 레이어를 복제하고 Y 위치를 누적 간격만큼 이동합니다.
- `원본 PSD 닫기` 옵션이 켜져 있으면 처리 후 원본 문서를 저장하지 않고 닫습니다.

이 방식은 일반 PSD 2개 병합에서는 정상 동작을 확인했지만, Photoshop이 파일 열기 중 복구/손상 경고 모달을 띄우는 PSD 묶음에서는 아래 알려진 이슈가 있습니다.

## 복구 모달 PSD 조사 메모

바탕화면 샘플 `01.psd`~`04.psd`를 PSD 헤더와 레이어 레코드 수준에서 읽어봤습니다. 네 파일 모두 PSD signature, 캔버스 크기, 레이어 카운트, 그룹 open/close marker는 파싱됩니다.

| 파일 | 크기(px) | 레이어 | 그룹 open/close | 메모 |
| --- | --- | ---: | --- | --- |
| `01.psd` | 360 x 2606 | 261 | 90 / 90 | Photoshop에서 복구 경고 발생 |
| `02.psd` | 360 x 3148 | 142 | 42 / 42 | 경고 없이 열리는 쪽 |
| `03.psd` | 360 x 1718 | 127 | 39 / 39 | Photoshop에서 복구 경고 발생 |
| `04.psd` | 360 x 4156 | 381 | 123 / 123 | Photoshop에서 복구 경고 발생 |

파서 기준으로는 그룹 marker 수가 맞기 때문에 단순한 PSD 레이어 섹션 파손처럼 보이지는 않습니다. Photoshop이 여는 과정에서 내부 group/layer descriptor, 외부 툴에서 만든 metadata, 또는 특정 레이어 데이터 일부를 복구하면서 `일부 그룹이 손상되어 수정하였습니다.` 경고를 띄우는 쪽에 가깝습니다.

## 모달 경고 때문에 병합이 빠지는 이유

Adobe 문서 기준으로 문서 생성, 문서 수정, 파일 열기처럼 Photoshop 상태를 바꾸는 작업은 `executeAsModal()` 안에서 실행해야 합니다. 그런데 `executeAsModal()`이 실행되는 동안 Photoshop은 modal user interaction state에 들어가고, 많은 UI가 제한됩니다.

`interactive: true`는 invoked dialog나 Select and Mask 같은 workspace에서 사용자 입력을 허용하기 위한 옵션이지만, 파일 열기 중 Photoshop 내부 복구 경고가 여러 파일에서 연속으로 뜨는 흐름까지 안정적으로 보장한다고 문서화되어 있지는 않습니다.

또 `batchPlay`의 `dialogOptions: "dontDisplay"`도 완전한 무시 옵션이 아닙니다. Adobe 문서상 오류가 있거나 추가 파라미터가 필요한 경우 UI가 다시 뜰 수 있습니다. 실제 포럼에도 `dontDisplay`/`silent`로도 대화상자를 억제하지 못한 사례가 있습니다.

그래서 `app.open()` 루프 안에서 복구 경고가 끼어들면 다음 파일이 완전히 열린 문서로 확정되기 전에 코드가 다음 단계로 진행하거나, Photoshop 내부 modal 상태와 플러그인 modal 상태가 충돌해 특정 PSD가 건너뛰어진 것처럼 보일 수 있습니다. 현재 증상인 `01, 02, 03` 중 `03`이 무시되거나 `03, 04` 중 뒤 파일이 빠지는 현상은 이 흐름과 맞습니다.

현실적인 우회는 자동 병합 전에 문제가 있는 PSD를 Photoshop에서 직접 열고 경고 확인 후 새 PSD로 다시 저장해서 복구 경고가 없는 깨끗한 파일로 만드는 것입니다. 이후 플러그인에서 그 저장본을 선택하면 `app.open()` 중간에 복구 모달이 끼지 않아 병합 안정성이 올라갑니다.

참고 문서:

- Adobe `executeAsModal`: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/executeasmodal/
- Adobe `ExecuteAsModalOptions.interactive`: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/objects/returnobjects/executeasmodaloptions/
- Adobe `app.open`: https://developer.adobe.com/photoshop/uxp/ps_reference/classes/photoshop/#open
- Adobe `batchPlay` dialogOptions: https://developer.adobe.com/photoshop/uxp/2022/ps_reference/media/batchplay/
- Adobe UXP `shell.openPath`: https://developer.adobe.com/photoshop/uxp/2021/uxp/reference-js/Modules/shell/Shell/
- Adobe UXP Manifest v5 launchProcess 권한: https://developer.adobe.com/photoshop/uxp/2022/guides/uxp_guide/uxp-misc/manifest-v5/
- Creative Cloud Developer Forum dialog freeze 사례: https://forums.creativeclouddeveloper.com/t/playing-a-photoshop-action-via-uxp-javascript-dialogs-are-freezing/4075
- Creative Cloud Developer Forum dialog suppression 사례: https://forums.creativeclouddeveloper.com/t/unable-to-suppress-fill-dialog-options-window/3985

## 다음 개선 후보

- 병합 후 PSD 저장 버튼
- 가로 병합 모드
- 파일명 정렬 규칙 UI
- PSD 크기/해상도 불일치 경고
- 패널 아이콘 재추가
