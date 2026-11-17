# clawd-buddy

Claude Code 데스크톱 앱의 입력창 위에 픽셀 게 Clawd를 띄우는 플러그인입니다.
Clawd는 Claude가 지금 하는 일을 따라 합니다.

## 설치

터미널 세션의 입력창에서 다음을 입력합니다.

```
/plugin install clawd-buddy --marketplace WhiteKr/whitekr-claude-plugins
```

`Add marketplace?`에 `y`로 답하고 설치 범위를 고릅니다.

셸에서 설치하려면 다음을 실행합니다.

```bash
claude plugin install clawd-buddy --marketplace WhiteKr/whitekr-claude-plugins
```

Clawd는 데스크톱 앱에서만 그립니다. 터미널에서는 아무것도 바꾸지 않습니다.

## 동작

| Claude가 하는 일 | Clawd |
| --- | --- |
| 쉬는 중 | 앉아서 졸기 |
| 생각하는 중 | 걷다가 멈춰 두리번거리기 |
| 파일 읽기 (`Read`, `cat` 등) | 책을 꺼내 펼쳐 읽고 책장 넘기기 |
| 검색 (`WebSearch`, `rg`, `find` 등) | 돋보기를 꺼내 눈 가까이 대고 들여다보기 |
| 편집, 명령 실행 | 노트북을 꺼내 타자 치기 |
| 질문하고 답을 기다리는 중 | 좌우로 몸 흔들기 |
| 턴 완료 | 제자리에서 들썩들썩 꽃게춤을 춘 뒤 졸기 |

물건을 꺼내고 집어넣는 동작이 이어지도록, 활동이 바뀌면 지금 동작을 마무리하고 서 있는 자세로 돌아온 뒤 다음 동작을 시작합니다.
다음 활동이 같은 동작이면 끊지 않고 이어서 재생합니다.

입력창 위 카드에 다른 플러그인의 줄이 없어 Clawd 혼자 카드를 쓸 때는, 생각하는 동안 카드 안을 좌우로 오가며 걷습니다.
claude.dev의 Clawd처럼 몇 초 걷다가 멈춰 두리번거리고, 끝에 닿으면 몸을 돌려 반대로 걷습니다. 다른 동작은 걷다 멈춘 자리에서 합니다.
다른 플러그인의 줄이 있으면 Clawd는 왼쪽에 서고 그 줄들이 오른쪽을 채웁니다.

## 그림

모든 클립은 50단위 픽셀 격자에 그린 그림에서 생성합니다.

- `tools/art/`에는 걷기, 방향 전환, 두리번거리기, 노트북, 졸기, 몸 흔들기 클립의 포즈와 프레임 순서가 들어 있습니다.
- `tools/draw_clips.py`는 책 읽기, 돋보기, 꽃게춤 클립을 그리고, 모든 클립을 `hooks/clawd-clips.ts`로 씁니다.

그림을 고친 뒤에는 다음을 실행합니다.

```bash
python3 -I tools/draw_clips.py hooks/clawd-clips.ts
```

Clawd 캐릭터와 `tools/art/`의 클립은 Claude 데스크톱 앱과 claude.dev의 Clawd 애니메이션을 옮긴 것이며, 그 권리는 Anthropic에 있습니다. 직접 그린 클립(책 읽기, 돋보기, 꽃게춤)도 그 애니메이션의 격자, 색, 동작 규칙을 따릅니다.
