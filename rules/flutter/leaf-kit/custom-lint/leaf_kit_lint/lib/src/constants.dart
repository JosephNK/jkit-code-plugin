// =============================================================================
// leaf_kit_lint — 상수 모음
// -----------------------------------------------------------------------------
// bloc/ 레이어에서 허용되는 외부 패키지 화이트리스트 + leaf_kit 전용 entrypoint.
// architecture_lint와 분리되어 leaf_kit_lint 패키지가 자체 소유.
// =============================================================================

/// bloc/ 레이어에서 허용되는 외부 패키지.
///
/// bloc은 상태 관리 + 이벤트 처리만 담당하므로 의존은 좁게 유지.
/// `flutter_leaf_kit_state.dart`/`flutter_leaf_kit_core.dart`는 별도로
/// `leafKitBlocAllowed`로 명시 허용.
const blocAllowedPackages = <String>{
  'flutter',
  'flutter_bloc',
  'bloc',
  'equatable',
  'meta',
  'collection',
};

/// bloc/에서 허용되는 leaf_kit entrypoint (full-path entry).
///
/// flutter_leaf_kit의 메인 entrypoint(`flutter_leaf_kit.dart`) 대신 영역별
/// 좁은 entrypoint만 허용. presentation/bloc은 상태/이벤트만 다루므로
/// component/network/route entrypoint는 차단.
const leafKitBlocAllowed = <String>{
  'flutter_leaf_kit/flutter_leaf_kit_state.dart',
  'flutter_leaf_kit/flutter_leaf_kit_core.dart',
};
