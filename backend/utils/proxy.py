from __future__ import annotations

from typing import Optional
from urllib.parse import urlparse, unquote


def normalize_proxy_url(raw: str) -> str:
    value = raw.strip()
    if not value:
        return value
        
    scheme = "socks5"
    if "://" in value:
        parts = value.split("://", 1)
        scheme, value = parts[0], parts[1]
        
    if "@" in value:
        return f"{scheme}://{value}"
        
    parts = value.split(":")
    if len(parts) == 2:
        host, port = parts
        return f"{scheme}://{host}:{port}"
    if len(parts) == 4:
        host, port, user, password = parts
        return f"{scheme}://{user}:{password}@{host}:{port}"
        
    return f"{scheme}://{value}"


def build_proxy_dict(raw: str) -> Optional[dict]:
    value = normalize_proxy_url(raw)
    if not value:
        return None
        
    try:
        parsed = urlparse(value)
        if not (parsed.scheme and parsed.hostname and parsed.port):
            raise ValueError("代理缺少 scheme, hostname 或 port")
            
        proxy = {
            "scheme": parsed.scheme,
            "hostname": parsed.hostname,
            "port": parsed.port,
        }
        if parsed.username:
            proxy["username"] = unquote(parsed.username) if hasattr(parsed, "username") and parsed.username else None
        if parsed.password:
            proxy["password"] = unquote(parsed.password) if hasattr(parsed, "password") and parsed.password else None
        return proxy
    except Exception as e:
        raise ValueError(f"代理格式解析失败: {str(e)}")
