#define UNICODE
#define _UNICODE
#include <windows.h>
#include <shellapi.h>
#include <wchar.h>

int WINAPI wWinMain(HINSTANCE instance,HINSTANCE previous,LPWSTR command,int show){
    wchar_t root[32768],runtime[32768],bootstrap[32768],cmd[65536];
    if(!GetModuleFileNameW(NULL,root,32768))return 1;
    wchar_t *end=wcsrchr(root,L'\\');if(!end)return 1;*end=0;
    swprintf(runtime,32768,L"%ls\\runtime\\WorkhubEngine.exe",root);
    swprintf(bootstrap,32768,L"%ls\\electron\\desktop-start.cjs",root);
    if(GetFileAttributesW(runtime)==INVALID_FILE_ATTRIBUTES||GetFileAttributesW(bootstrap)==INVALID_FILE_ATTRIBUTES){
        MessageBoxW(NULL,L"Extraé el ZIP de transición dentro de la carpeta actual de WorkHub y aceptá reemplazar archivos. WorkHub.exe necesita las carpetas runtime y electron a su lado. No lo abras desde el ZIP.",L"WorkHub",MB_OK|MB_ICONERROR);return 1;
    }
    wchar_t active[32768], recovery[32768], ready[32768];
    swprintf(active,32768,L"%ls\\.workhub-updates\\active.json",root);
    swprintf(recovery,32768,L"%ls\\.workhub-updates\\recovery-runtime\\WorkhubEngine.exe",root);
    swprintf(ready,32768,L"%ls\\.workhub-updates\\recovery-runtime\\.ready",root);
    if(GetFileAttributesW(ready)!=INVALID_FILE_ATTRIBUTES && GetFileAttributesW(active)!=INVALID_FILE_ATTRIBUTES && GetFileAttributesW(recovery)!=INVALID_FILE_ATTRIBUTES)wcscpy(runtime,recovery);
    SetEnvironmentVariableW(L"ELECTRON_RUN_AS_NODE",L"1");
    swprintf(cmd,65536,L"\"%ls\" \"%ls\"",runtime,bootstrap);
    STARTUPINFOW si={0};PROCESS_INFORMATION pi={0};si.cb=sizeof(si);si.dwFlags=STARTF_USESHOWWINDOW;si.wShowWindow=SW_HIDE;
    if(!CreateProcessW(runtime,cmd,NULL,NULL,FALSE,CREATE_NO_WINDOW,NULL,root,&si,&pi)){
        MessageBoxW(NULL,L"No se pudo iniciar WorkHub. Comprobá que runtime\\WorkhubEngine.exe siga en la carpeta del programa.",L"WorkHub",MB_OK|MB_ICONERROR);return 1;
    }
    // The launcher must release its own EXE before recovery can replace it.
    CloseHandle(pi.hThread);CloseHandle(pi.hProcess);
    return 0;
}

