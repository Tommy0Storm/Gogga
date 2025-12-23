/**
 * Universal Icon Mapping Service
 * Domain-Aware Canonical Icons for Google Material Icons
 * 
 * Normalizes alternative icon names to their canonical Material Icon equivalents.
 * All canonical icons are validated Material Icons from fonts.google.com/icons
 */

export const UNIVERSAL_ICON_MAP: Record<string, string> = {
  // WEATHER domain (Open-Meteo WMO codes mapped to Material Icons)
  // Plain names
  'weather': 'wb_sunny',
  'sunny': 'wb_sunny',
  'sun': 'wb_sunny',
  'clear': 'wb_sunny',
  'clear_day': 'wb_sunny',
  'clear_night': 'nights_stay',
  'moon': 'nights_stay',
  'night': 'nights_stay',
  'partly_cloudy': 'wb_cloudy',
  'partly_cloudy_day': 'wb_cloudy',
  'cloudy': 'cloud',
  'overcast': 'cloud',
  'fog': 'foggy',
  'foggy': 'foggy',
  'mist': 'foggy',
  'drizzle': 'grain',
  'light_rain': 'grain',
  'rain': 'rainy',
  'rainy': 'rainy',
  'heavy_rain': 'rainy',
  'showers': 'rainy',
  'thunderstorm': 'thunderstorm',
  'storm': 'thunderstorm',
  'lightning': 'thunderstorm',
  'snow': 'ac_unit',
  'snowy': 'ac_unit',
  'snowflake': 'ac_unit',
  'hail': 'thunderstorm',
  'wind': 'air',
  'windy': 'air',
  'humidity': 'water_drop',
  'temperature': 'thermostat',
  'thermometer': 'thermostat',
  'uv': 'wb_sunny',
  'uv_index': 'wb_sunny',
  // icon_ prefixed versions (for AI text output)
  'icon_weather': 'wb_sunny',
  'icon_sunny': 'wb_sunny',
  'icon_sun': 'wb_sunny',
  'icon_clear': 'wb_sunny',
  'icon_clear_day': 'wb_sunny',
  'icon_clear_night': 'nights_stay',
  'icon_moon': 'nights_stay',
  'icon_night': 'nights_stay',
  'icon_partly_cloudy': 'wb_cloudy',
  'icon_partly_cloudy_day': 'wb_cloudy',
  'icon_cloudy': 'cloud',
  'icon_cloud': 'cloud',
  'icon_overcast': 'cloud',
  'icon_fog': 'foggy',
  'icon_foggy': 'foggy',
  'icon_mist': 'foggy',
  'icon_drizzle': 'grain',
  'icon_light_rain': 'grain',
  'icon_rain': 'rainy',
  'icon_rainy': 'rainy',
  'icon_heavy_rain': 'rainy',
  'icon_showers': 'rainy',
  'icon_thunderstorm': 'thunderstorm',
  'icon_storm': 'thunderstorm',
  'icon_lightning': 'thunderstorm',
  'icon_snow': 'ac_unit',
  'icon_snowy': 'ac_unit',
  'icon_snowflake': 'ac_unit',
  'icon_hail': 'thunderstorm',
  'icon_wind': 'air',
  'icon_windy': 'air',
  'icon_humidity': 'water_drop',
  'icon_temperature': 'thermostat',
  'icon_thermometer': 'thermostat',
  'icon_uv': 'wb_sunny',
  'icon_uv_index': 'wb_sunny',
  
  // COOKING & FOOD domain
  'fireplace': 'local_fire_department', 
  'whatshot': 'local_fire_department', 
  'fire': 'local_fire_department', 
  'oven': 'microwave',
  'auto_mixer': 'blender', 
  'kitchen': 'countertops',
  'content_cut': 'restaurant', 
  'scissors': 'content_cut',
  'kitchen_knife': 'restaurant',
  'ruler': 'straighten',
  'cookie': 'bakery_dining', 
  'pie': 'bakery_dining',
  'baking_production': 'bakery_dining',
  'local_dining': 'restaurant', 
  'room_service': 'restaurant', 
  'dining': 'restaurant', 
  'fastfood': 'lunch_dining',
  'timer': 'schedule', 
  'access_time': 'schedule',
  'set_meal': 'ramen_dining', 
  'lunch_dining': 'ramen_dining', 
  'container': 'takeout_dining',
  'bowl': 'ramen_dining',
  'call_merge': 'merge_type', 
  'unarchive': 'unarchive',
  'mixingbowl': 'blender', 
  'spatula': 'restaurant', 
  'eggs': 'egg_alt',
  'egg': 'egg_alt',

  // TECHNOLOGY & CODING domain
  'error_outline': 'error', 
  'cancel': 'cancel',
  'done': 'check_circle', 
  'verified': 'verified', 
  'task_alt': 'check_circle', 
  'done_all': 'done_all',
  'priority_high': 'warning', 
  'report_problem': 'warning',
  'autorenew': 'autorenew', 
  'hourglass_empty': 'hourglass_empty',
  'loop': 'loop',
  'code': 'code',
  'bug_report': 'bug_report',
  'backup': 'backup', 
  'cloud_download': 'cloud_download',
  'save': 'save',
  'send': 'send', 
  'rocket_launch': 'rocket_launch',
  'publish': 'publish',
  'handyman': 'handyman', 
  'construction': 'construction',
  'build': 'build',
  'database': 'storage', 
  'cloud_queue': 'cloud_queue',
  'storage': 'storage',
  'api': 'api', 
  'router': 'router',
  'cloud': 'cloud',
  'security': 'security', 
  'verified_user': 'verified_user',
  'lock': 'lock',
  'delete_forever': 'delete_forever', 
  'remove': 'remove',
  'delete': 'delete',

  // HEALTH & MEDICAL domain
  'healing': 'healing', 
  'heart_plus': 'favorite',
  'favorite': 'favorite',
  'medication': 'medication', 
  'vaccine': 'vaccines',
  'pills': 'medication',
  'sentiment_very_dissatisfied': 'sentiment_very_dissatisfied',
  'sick': 'sick',
  'directions_run': 'directions_run', 
  'sports': 'sports',
  'fitness_center': 'fitness_center',
  'medical_information': 'medical_information', 
  'emergency': 'emergency',
  'person_health': 'health_and_safety',
  'medical_services': 'medical_services', 
  'local_hospital': 'local_hospital',
  'apple': 'nutrition',
  'hotel': 'hotel', 
  'bedroom_baby': 'bedroom_baby',
  'bedtime': 'bedtime',
  'monitor_weight': 'monitor_weight',
  'scale': 'scale',
  'directions_bike': 'directions_bike',
  'directions_walk': 'directions_walk',

  // BUSINESS & FINANCE domain
  'currency_exchange': 'currency_exchange', 
  'payment': 'payments',
  'attach_money': 'attach_money',
  'arrow_upward': 'arrow_upward', 
  'show_chart': 'show_chart', 
  'bar_chart': 'bar_chart',
  'trending_up': 'trending_up',
  'arrow_downward': 'arrow_downward',
  'trending_down': 'trending_down',
  'auto_invest': 'savings', 
  'savings': 'savings',
  'credit_card': 'credit_card', 
  'wallet': 'account_balance_wallet',
  'article': 'article', 
  'contract': 'description',
  'description': 'description',
  'calendar_today': 'calendar_today',
  'event': 'event',
  'edit_note': 'edit_note',
  'slideshow': 'slideshow',
  'assessment': 'assessment', 
  'auto_stories': 'auto_stories',
  'people': 'people', 
  'supervisor_account': 'supervisor_account',
  'groups': 'groups',
  'gps_fixed': 'gps_fixed', 
  'track_changes': 'track_changes',
  'bullseye': 'adjust',

  // LEARNING & EDUCATION domain
  'book': 'menu_book',
  'school': 'school',
  'task': 'task', 
  'assignment_turned_in': 'assignment_turned_in',
  'assignment': 'assignment',
  'help_outline': 'help_outline', 
  'question_mark': 'help',
  'help': 'help',
  'comment': 'comment', 
  'chat': 'chat',
  'forum': 'forum',
  'play_circle': 'play_circle', 
  'movie': 'movie',
  'videocam': 'videocam',
  'file_copy': 'file_copy', 
  'insert_drive_file': 'insert_drive_file',
  'speed': 'speed',
  'military_tech': 'military_tech', 
  'card_giftcard': 'card_giftcard',

  // TRAVEL & TRANSPORTATION domain
  'flight_takeoff': 'flight_takeoff', 
  'flight_land': 'flight_land',
  'flight': 'flight',
  'bed': 'bed',
  'two_wheeler': 'two_wheeler', 
  'train': 'train',
  'directions_car': 'directions_car',
  'map': 'map', 
  'pin_drop': 'pin_drop',
  'location_on': 'location_on',
  'place': 'place',
  'directions': 'directions',
  'navigation': 'navigation',
  'event_available': 'event_available',
  'sell': 'sell',
  'confirmation_number': 'confirmation_number',
  'backpack': 'backpack', 
  'shopping_bag': 'shopping_bag',
  'luggage': 'luggage',
  'document_scanner': 'document_scanner',
  'card_travel': 'card_travel',

  // SOCIAL & COMMUNICATION domain
  'message': 'message', 
  'mail_outline': 'mail_outline',
  'mail': 'mail',
  'smartphone': 'smartphone', 
  'call': 'call',
  'phone': 'phone',
  'video_call': 'video_call',
  'share_location': 'share_location', 
  'file_download': 'file_download',
  'share': 'share',
  'thumb_up': 'thumb_up', 
  'star': 'star',
  'following': 'person_add_alt', 
  'person_plus_one': 'person_add',
  'person_add': 'person_add',
  'notifications_active': 'notifications_active',
  'notifications': 'notifications',
  'no_accounts': 'no_accounts',
  'block': 'block',
  'report': 'report',
  'flag': 'flag',

  // MEDIA & CREATIVE domain
  'photo': 'photo', 
  'image_aspect_ratio': 'image',
  'image': 'image',
  'video_library': 'video_library',
  'headphones': 'headphones', 
  'volume_up': 'volume_up',
  'music_note': 'music_note',
  'create': 'create',
  'edit': 'edit',
  'color_lens': 'color_lens', 
  'brush': 'brush',
  'palette': 'palette',
  'adjust': 'tune', 
  'graphic_eq': 'graphic_eq',
  'tune': 'tune',
  'crop_square': 'crop',
  'crop': 'crop',
  'cloud_upload': 'cloud_upload',
  'upload': 'upload',
  'get_app': 'download',
  'download': 'download',

  // WEATHER & NATURE domain (additional)
  'light_mode': 'light_mode', 
  'wb_sunny': 'wb_sunny',
  'grain': 'grain', 
  'opacity': 'opacity',
  'flash_on': 'flash_on',
  'cloud_circle': 'cloud',
  'device_thermostat': 'thermostat',
  'water': 'water_drop',
  'expand': 'open_in_full',
  'compress': 'close_fullscreen',

  // SPORTS & FITNESS domain
  'sports_bar': 'sports_bar',

  // HOME & LIVING domain
  'couch': 'weekend',
  'chair': 'chair',
  'microwave': 'microwave',
  'bedroom_parent': 'king_bed',
  'shower': 'shower', 
  'wc': 'wc',
  'bathtub': 'bathtub',
  'vacuum': 'cleaning_services', 
  'soap': 'soap',
  'cleaning_services': 'cleaning_services',
  'lightbulb': 'lightbulb',
  'brush_icon': 'brush',

  // SHOPPING & ECOMMERCE domain
  'local_offer': 'local_offer',
  'shopping_cart': 'shopping_cart',
  'inventory_2': 'inventory_2',
  'local_shipping': 'local_shipping',
  'undo': 'undo', 
  'restore': 'restore',
  'assignment_return': 'assignment_return',
  'discount': 'discount',
  'rate_review': 'rate_review', 
  'feedback': 'feedback',
  'favorite_border': 'favorite_border',
  'tabs': 'tab', 
  'view_list': 'view_list',
  'category': 'category',
  'magnifying_glass': 'search', 
  'find_in_page': 'find_in_page',
  'search': 'search',

  // ENVIRONMENT & SUSTAINABILITY domain
  'eco': 'eco', 
  'spa': 'spa',
  'recycle': 'recycling',
  'bolt': 'bolt',
  'nature': 'park',
  'park': 'park',

  // GENERAL ACTIONS domain
  'add_circle': 'add_circle', 
  'add_box': 'add_box',
  'add': 'add',
  'information': 'info',
  'info': 'info',
  'open_in_browser': 'open_in_new', 
  'launch': 'launch',
  'open_in_new': 'open_in_new',
  'expand_less': 'expand_less', 
  'unfold_more': 'unfold_more',
  'expand_more': 'expand_more',
  'unfold_less': 'unfold_less', 
  'keyboard_arrow_up': 'keyboard_arrow_up',
};

/**
 * Normalizes an icon name to its canonical Material Icon equivalent
 */
export function normalizeIcon(iconName: string): string {
  if (!iconName) return iconName;
  const normalized = iconName.toLowerCase().trim();
  return UNIVERSAL_ICON_MAP[normalized] ?? normalized;
}

/**
 * Normalizes icon references within text using [icon_name] syntax
 */
export function normalizeIconsInText(text: string): string {
  if (!text) return text;
  
  return text.replace(/\[([a-z_]+)\]/g, (match, iconName) => {
    const normalized = normalizeIcon(iconName);
    return `[${normalized}]`;
  });
}

/**
 * Tool Icon Mapping - Maps tool names to Lucide React icon components
 */
import {
  Calculator,
  Code,
  Search,
  Globe,
  FileText,
  Image,
  MessageSquare,
  Database,
  Brain,
  Zap,
  Terminal,
  CloudSun,
  MapPin,
  Calendar,
  Clock,
  Mail,
  Bell,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const TOOL_ICON_MAP: Record<string, LucideIcon> = {
  // Math tools
  'calculate': Calculator,
  'calculator': Calculator,
  'math': Calculator,
  'solve': Calculator,
  'wolfram_alpha': Calculator,
  'goggasolve': Calculator,
  
  // Code tools
  'code': Code,
  'execute_code': Code,
  'python': Code,
  'javascript': Code,
  'run_code': Code,
  
  // Search tools
  'search': Search,
  'web_search': Search,
  'google_search': Search,
  'find': Search,
  
  // Web tools
  'browse': Globe,
  'fetch_url': Globe,
  'web': Globe,
  'http': Globe,
  
  // Document tools
  'document': FileText,
  'read_file': FileText,
  'write_file': FileText,
  'file': FileText,
  
  // Image tools
  'image': Image,
  'generate_image': Image,
  'analyze_image': Image,
  'vision': Image,
  
  // Chat tools
  'chat': MessageSquare,
  'message': MessageSquare,
  'conversation': MessageSquare,
  
  // Database tools
  'database': Database,
  'query': Database,
  'sql': Database,
  
  // AI tools
  'ai': Brain,
  'llm': Brain,
  'thinking': Brain,
  
  // Weather tools
  'weather': CloudSun,
  'forecast': CloudSun,
  
  // Location tools
  'location': MapPin,
  'geocode': MapPin,
  'places': MapPin,
  
  // Time tools
  'calendar': Calendar,
  'schedule': Calendar,
  'time': Clock,
  'timer': Clock,
  
  // Communication
  'email': Mail,
  'send_email': Mail,
  'notification': Bell,
  'notify': Bell,
  
  // System
  'settings': Settings,
  'config': Settings,
  'tool': Wrench,
};

/**
 * Get the appropriate Lucide icon for a tool name
 * Falls back to Wrench for unknown tools
 */
export function getToolIcon(toolName: string): LucideIcon {
  const normalizedName = toolName.toLowerCase().replace(/[-\s]/g, '_');
  
  // Direct match
  if (TOOL_ICON_MAP[normalizedName]) {
    return TOOL_ICON_MAP[normalizedName];
  }
  
  // Partial match (check if any key is contained in the tool name)
  for (const [key, icon] of Object.entries(TOOL_ICON_MAP)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return icon;
    }
  }
  
  // Default fallback
  return Wrench;
}

/**
 * Icon Mapping Service - Unified interface
 */
export const IconMappingService = {
  normalize: normalizeIcon,
  normalizeText: normalizeIconsInText,
  getToolIcon,
  MAP: UNIVERSAL_ICON_MAP,
} as const;

export default IconMappingService;