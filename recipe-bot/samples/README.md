# samples/

여기에 테스트용 이미지를 두세요. 폰으로 냉장고 안을 한 장 찍어서 `fridge.jpg`로 저장하면 됩니다.

```bash
# 예시
cp ~/Downloads/IMG_1234.JPG samples/fridge.jpg
npx tsx src/index.ts ./samples/fridge.jpg
```

이 폴더의 이미지 파일은 `.gitignore`로 무시됩니다 (개인 사진이 레포에 들어가지 않게).
