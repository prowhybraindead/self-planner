from functools import lru_cache
from supabase import Client, create_client
from config import get_settings


@lru_cache(maxsize=1)
def get_supabase_admin() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
