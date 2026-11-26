export type AccessType = "in" | "out" | "parcel" | "vehicle" | "delivery" | "provider";
export type ResidentStatus = "activo" | "pendiente" | "inactivo";
export type ShiftType = "mañana" | "tarde" | "noche";
export type ShiftStatus = "programado" | "activo" | "completado" | "libre" | "sin_cubrir";
export type PassStatus = "activo" | "usado" | "revocado" | "vencido";
export type RequestKind = "visita" | "delivery" | "proveedor";
export type RequestStatus = "pendiente" | "aprobada" | "rechazada" | "vencida" | "sin_respuesta";
export type ParkingKind = "residente" | "visita";
export type AttendanceSource = "tablet" | "sesion" | "admin";
export type ParcelStatus = "pendiente" | "retirada";
export type PickupMethod = "codigo" | "qr" | "manual";
export type NoticeKind = "agua" | "luz" | "gas" | "internet" | "ascensor" | "fumigacion" | "obra" | "aseo" | "otro";
export type NoticeScope = "edificio" | "unidad";
export type NoticeSource = "admin" | "porteria";
export type Tenancy = "propietario" | "arrendatario" | "otro";
export type PetSpecies = "perro" | "gato" | "otro";

export type SignupStatus = "pendiente" | "aprobada" | "rechazada";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; plan: string; created_at: string };
        Insert: { id?: string; name: string; slug: string; plan?: string; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; plan?: string; created_at?: string };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; organization_id: string | null; role: string; full_name: string | null; created_at: string };
        Insert: { id: string; organization_id?: string | null; role?: string; full_name?: string | null; created_at?: string };
        Update: { id?: string; organization_id?: string | null; role?: string; full_name?: string | null; created_at?: string };
        Relationships: [];
      };
      buildings: {
        Row: { id: string; name: string; address: string | null; units_total: number; organization_id: string | null; join_code: string | null; join_code_updated_at: string | null; created_at: string };
        Insert: { id?: string; name: string; address?: string | null; units_total?: number; organization_id?: string | null; join_code?: string | null; join_code_updated_at?: string | null; created_at?: string };
        Update: { id?: string; name?: string; address?: string | null; units_total?: number; organization_id?: string | null; join_code?: string | null; join_code_updated_at?: string | null; created_at?: string };
        Relationships: [];
      };
      residents: {
        Row: { id: string; building_id: string; unit_code: string; name: string; household: string | null; tags: string[]; rut: string | null; contact: string | null; status: ResidentStatus; tenancy: Tenancy | null; profile_updated_at: string | null; invite_email: string | null; invited_at: string | null; created_at: string };
        Insert: { id?: string; building_id: string; unit_code: string; name: string; household?: string | null; tags?: string[]; rut?: string | null; contact?: string | null; status?: ResidentStatus; tenancy?: Tenancy | null; profile_updated_at?: string | null; invite_email?: string | null; invited_at?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; unit_code?: string; name?: string; household?: string | null; tags?: string[]; rut?: string | null; contact?: string | null; status?: ResidentStatus; tenancy?: Tenancy | null; profile_updated_at?: string | null; invite_email?: string | null; invited_at?: string | null; created_at?: string };
        Relationships: [];
      };
      frequent_visitors: {
        Row: { id: string; building_id: string; name: string; rut: string | null; reason: string | null; default_unit: string | null; last_unit: string | null; kind: string | null; visit_count: number; last_seen_at: string | null; created_at: string };
        Insert: { id?: string; building_id: string; name: string; rut?: string | null; reason?: string | null; default_unit?: string | null; last_unit?: string | null; kind?: string | null; visit_count?: number; last_seen_at?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; name?: string; rut?: string | null; reason?: string | null; default_unit?: string | null; last_unit?: string | null; kind?: string | null; visit_count?: number; last_seen_at?: string | null; created_at?: string };
        Relationships: [];
      };
      access_log: {
        Row: { id: string; building_id: string; type: AccessType; who: string; context: string | null; unit: string | null; plate: string | null; recorded_by: string | null; recorded_at: string; request_id: string | null; authorized_by: string | null; rut: string | null };
        Insert: { id?: string; building_id: string; type: AccessType; who: string; context?: string | null; unit?: string | null; plate?: string | null; recorded_by?: string | null; recorded_at?: string; request_id?: string | null; authorized_by?: string | null; rut?: string | null };
        Update: { id?: string; building_id?: string; type?: AccessType; who?: string; context?: string | null; unit?: string | null; plate?: string | null; recorded_by?: string | null; recorded_at?: string; request_id?: string | null; authorized_by?: string | null; rut?: string | null };
        Relationships: [];
      };
      resident_signups: {
        Row: { id: string; building_id: string; unit_code: string; name: string; email: string; phone: string | null; status: SignupStatus; resident_id: string | null; reviewed_by: string | null; reviewed_at: string | null; note: string | null; created_at: string };
        Insert: { id?: string; building_id: string; unit_code: string; name: string; email: string; phone?: string | null; status?: SignupStatus; resident_id?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; note?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; unit_code?: string; name?: string; email?: string; phone?: string | null; status?: SignupStatus; resident_id?: string | null; reviewed_by?: string | null; reviewed_at?: string | null; note?: string | null; created_at?: string };
        Relationships: [];
      };
      resident_members: {
        Row: { id: string; building_id: string; resident_id: string; profile_id: string; created_at: string };
        Insert: { id?: string; building_id: string; resident_id: string; profile_id: string; created_at?: string };
        Update: { id?: string; building_id?: string; resident_id?: string; profile_id?: string; created_at?: string };
        Relationships: [];
      };
      visit_passes: {
        Row: { id: string; building_id: string; resident_id: string; created_by: string | null; created_by_name: string | null; visitor_name: string; visitor_rut: string | null; plate: string | null; note: string | null; valid_from: string; valid_until: string; single_use: boolean; used_at: string | null; used_count: number; status: PassStatus; token: string | null; code: string | null; created_at: string };
        Insert: { id?: string; building_id: string; resident_id: string; created_by?: string | null; created_by_name?: string | null; visitor_name: string; visitor_rut?: string | null; plate?: string | null; note?: string | null; valid_from?: string; valid_until: string; single_use?: boolean; used_at?: string | null; used_count?: number; status?: PassStatus; token?: string | null; code?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; resident_id?: string; created_by?: string | null; created_by_name?: string | null; visitor_name?: string; visitor_rut?: string | null; plate?: string | null; note?: string | null; valid_from?: string; valid_until?: string; single_use?: boolean; used_at?: string | null; used_count?: number; status?: PassStatus; token?: string | null; code?: string | null; created_at?: string };
        Relationships: [];
      };
      access_requests: {
        Row: { id: string; building_id: string; resident_id: string | null; unit_code: string | null; visitor_name: string; visitor_rut: string | null; plate: string | null; kind: RequestKind; status: RequestStatus; requested_by: string | null; expires_at: string; responded_at: string | null; responded_by: string | null; responded_by_name: string | null; pass_id: string | null; access_log_id: string | null; created_at: string };
        Insert: { id?: string; building_id: string; resident_id?: string | null; unit_code?: string | null; visitor_name: string; visitor_rut?: string | null; plate?: string | null; kind?: RequestKind; status?: RequestStatus; requested_by?: string | null; expires_at: string; responded_at?: string | null; responded_by?: string | null; responded_by_name?: string | null; pass_id?: string | null; access_log_id?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; resident_id?: string | null; unit_code?: string | null; visitor_name?: string; visitor_rut?: string | null; plate?: string | null; kind?: RequestKind; status?: RequestStatus; requested_by?: string | null; expires_at?: string; responded_at?: string | null; responded_by?: string | null; responded_by_name?: string | null; pass_id?: string | null; access_log_id?: string | null; created_at?: string };
        Relationships: [];
      };
      push_subscriptions: {
        Row: { id: string; profile_id: string; endpoint: string; p256dh: string; auth: string; user_agent: string | null; created_at: string };
        Insert: { id?: string; profile_id: string; endpoint: string; p256dh: string; auth: string; user_agent?: string | null; created_at?: string };
        Update: { id?: string; profile_id?: string; endpoint?: string; p256dh?: string; auth?: string; user_agent?: string | null; created_at?: string };
        Relationships: [];
      };
      parking_spots: {
        Row: { id: string; building_id: string; code: string; kind: ParkingKind; unit_code: string | null; active: boolean; notes: string | null; created_at: string; lent_until: string | null; lent_by: string | null; lent_at: string | null };
        Insert: { id?: string; building_id: string; code: string; kind?: ParkingKind; unit_code?: string | null; active?: boolean; notes?: string | null; created_at?: string; lent_until?: string | null; lent_by?: string | null; lent_at?: string | null };
        Update: { id?: string; building_id?: string; code?: string; kind?: ParkingKind; unit_code?: string | null; active?: boolean; notes?: string | null; created_at?: string; lent_until?: string | null; lent_by?: string | null; lent_at?: string | null };
        Relationships: [];
      };
      resident_vehicles: {
        Row: { id: string; building_id: string; resident_id: string; plate: string; model: string | null; created_by: string | null; created_at: string };
        Insert: { id?: string; building_id: string; resident_id: string; plate: string; model?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; resident_id?: string; plate?: string; model?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [];
      };
      parking_sessions: {
        Row: { id: string; building_id: string; spot_id: string; plate: string; driver_name: string | null; rut: string | null; unit_code: string | null; access_log_id: string | null; started_at: string; ended_at: string | null; created_by: string | null; released_by: string | null };
        Insert: { id?: string; building_id: string; spot_id: string; plate: string; driver_name?: string | null; rut?: string | null; unit_code?: string | null; access_log_id?: string | null; started_at?: string; ended_at?: string | null; created_by?: string | null; released_by?: string | null };
        Update: { id?: string; building_id?: string; spot_id?: string; plate?: string; driver_name?: string | null; rut?: string | null; unit_code?: string | null; access_log_id?: string | null; started_at?: string; ended_at?: string | null; created_by?: string | null; released_by?: string | null };
        Relationships: [];
      };
      staff: {
        Row: { id: string; building_id: string; name: string; rut: string | null; role: string; contact: string | null; hourly_rate: number | null; active: boolean; email: string | null; emergency_name: string | null; emergency_phone: string | null; profile_id: string | null; created_at: string };
        Insert: { id?: string; building_id: string; name: string; rut?: string | null; role?: string; contact?: string | null; hourly_rate?: number | null; active?: boolean; email?: string | null; emergency_name?: string | null; emergency_phone?: string | null; profile_id?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; name?: string; rut?: string | null; role?: string; contact?: string | null; hourly_rate?: number | null; active?: boolean; email?: string | null; emergency_name?: string | null; emergency_phone?: string | null; profile_id?: string | null; created_at?: string };
        Relationships: [];
      };
      household_members: {
        Row: { id: string; building_id: string; resident_id: string; name: string; relationship: string | null; created_at: string };
        Insert: { id?: string; building_id: string; resident_id: string; name: string; relationship?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; resident_id?: string; name?: string; relationship?: string | null; created_at?: string };
        Relationships: [];
      };
      pets: {
        Row: { id: string; building_id: string; resident_id: string; species: PetSpecies; name: string | null; notes: string | null; created_at: string };
        Insert: { id?: string; building_id: string; resident_id: string; species?: PetSpecies; name?: string | null; notes?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; resident_id?: string; species?: PetSpecies; name?: string | null; notes?: string | null; created_at?: string };
        Relationships: [];
      };
      parcels: {
        Row: { id: string; building_id: string; resident_id: string | null; unit_code: string | null; courier: string | null; description: string | null; code: string; token: string; status: ParcelStatus; received_at: string; received_by: string | null; access_log_id: string | null; notified_at: string | null; picked_up_at: string | null; picked_up_by: string | null; picked_up_rut: string | null; pickup_method: PickupMethod | null; pickup_log_id: string | null; created_at: string };
        Insert: { id?: string; building_id: string; resident_id?: string | null; unit_code?: string | null; courier?: string | null; description?: string | null; code: string; token: string; status?: ParcelStatus; received_at?: string; received_by?: string | null; access_log_id?: string | null; notified_at?: string | null; picked_up_at?: string | null; picked_up_by?: string | null; picked_up_rut?: string | null; pickup_method?: PickupMethod | null; pickup_log_id?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; resident_id?: string | null; unit_code?: string | null; courier?: string | null; description?: string | null; code?: string; token?: string; status?: ParcelStatus; received_at?: string; received_by?: string | null; access_log_id?: string | null; notified_at?: string | null; picked_up_at?: string | null; picked_up_by?: string | null; picked_up_rut?: string | null; pickup_method?: PickupMethod | null; pickup_log_id?: string | null; created_at?: string };
        Relationships: [];
      };
      notices: {
        Row: { id: string; building_id: string; kind: NoticeKind; title: string; body: string | null; scope: NoticeScope; unit_code: string | null; starts_at: string; ends_at: string | null; source: NoticeSource; access_log_id: string | null; created_by: string | null; created_by_name: string | null; notified_at: string | null; cancelled_at: string | null; created_at: string };
        Insert: { id?: string; building_id: string; kind?: NoticeKind; title: string; body?: string | null; scope?: NoticeScope; unit_code?: string | null; starts_at?: string; ends_at?: string | null; source?: NoticeSource; access_log_id?: string | null; created_by?: string | null; created_by_name?: string | null; notified_at?: string | null; cancelled_at?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; kind?: NoticeKind; title?: string; body?: string | null; scope?: NoticeScope; unit_code?: string | null; starts_at?: string; ends_at?: string | null; source?: NoticeSource; access_log_id?: string | null; created_by?: string | null; created_by_name?: string | null; notified_at?: string | null; cancelled_at?: string | null; created_at?: string };
        Relationships: [];
      };
      attendance: {
        Row: { id: string; building_id: string; staff_id: string; date: string; checked_in_at: string; checked_out_at: string | null; shift_id: string | null; late_minutes: number | null; early_leave_minutes: number | null; source: AttendanceSource; closed_source: AttendanceSource | null; note: string | null; created_at: string };
        Insert: { id?: string; building_id: string; staff_id: string; date: string; checked_in_at?: string; checked_out_at?: string | null; shift_id?: string | null; late_minutes?: number | null; early_leave_minutes?: number | null; source?: AttendanceSource; closed_source?: AttendanceSource | null; note?: string | null; created_at?: string };
        Update: { id?: string; building_id?: string; staff_id?: string; date?: string; checked_in_at?: string; checked_out_at?: string | null; shift_id?: string | null; late_minutes?: number | null; early_leave_minutes?: number | null; source?: AttendanceSource; closed_source?: AttendanceSource | null; note?: string | null; created_at?: string };
        Relationships: [];
      };
      shifts: {
        Row: { id: string; building_id: string; staff_id: string; date: string; type: ShiftType; start_time: string; end_time: string; location: string | null; status: ShiftStatus; created_at: string };
        Insert: { id?: string; building_id: string; staff_id: string; date: string; type: ShiftType; start_time: string; end_time: string; location?: string | null; status?: ShiftStatus; created_at?: string };
        Update: { id?: string; building_id?: string; staff_id?: string; date?: string; type?: ShiftType; start_time?: string; end_time?: string; location?: string | null; status?: ShiftStatus; created_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** migration_v17: anota un error y dice si es nuevo (o volvió tras resolverse). */
      registrar_error: {
        Args: {
          p_huella: string;
          p_origen: "navegador" | "servidor";
          p_donde: string;
          p_mensaje: string;
          p_detalle: Record<string, unknown>;
          p_usuario_id: string | null;
          p_organizacion_id: string | null;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
