; Repair only a stale per-user install location before electron-builder chooses
; its destination. This can happen when an older test installer recorded a
; path belonging to a build/sandbox account. A valid existing install is left
; untouched, so normal in-place upgrades still use their original folder.
!macro preInit
  SetShellVarContext current
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  StrCmp $0 "" hearthCampInstallLocationDone
  IfFileExists "$0\${APP_EXECUTABLE_FILENAME}" hearthCampInstallLocationDone
  DeleteRegValue HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  hearthCampInstallLocationDone:
!macroend
