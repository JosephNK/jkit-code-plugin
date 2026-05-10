/**
 * 순수 레이어(model/port/exception)에서 import 금지되는 프레임워크 패키지.
 * 테스트 용이성·이식성 보장 위해 프레임워크 중립 유지.
 */
export const baseFrameworkBannedPackages = [
  "@nestjs/*",
  "class-validator",
  "class-transformer",
  "express",
  "express/*",
];
