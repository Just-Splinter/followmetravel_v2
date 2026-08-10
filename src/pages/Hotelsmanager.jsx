import { useState, useMemo } from "react";
import {
  Hotel, MapPin, Star, Calendar, DollarSign, Users,
  Plus, Edit, Trash2, Search,
  CheckCircle, XCircle, Bed, Utensils,
  ChevronDown, ChevronUp, Save, X, Wifi, Coffee,
  Car, Dumbbell, Waves, Shield
} from "lucide-react";

// Design Tokens
const T = {
  primary: "#7F77DD",
  primaryDim: "#EEEDFE",
  secondary: "#1D9E75",
  accent: "#D85A30",
  warning: "#BA7517",
  success: "#1D9E75",
  gray: "#64748b",
  lightGray: "#f1f5f9",
};

// Données initiales exemple
const INITIAL_HOTELS = [
  {
    id: "1",
    name: "Grand Concordia",
    city: "Pékin",
    address: "123 Avenue Principale",
    rating: 4.5,
    stars: 5,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945",
    amenities: ["wifi", "parking", "pool", "gym", "restaurant"],
    rooms: [
      {
        id: "r1",
        category: "Standard",
        type: "Single",
        basePrice: 120,
        capacity: 1,
        size: 25,
        mealPlans: [
          { type: "breakfast", price: 0, included: true },
          { type: "halfBoard", price: 35, included: false },
          { type: "fullBoard", price: 65, included: false },
          { type: "allInclusive", price: 95, included: false },
        ],
        availability: [
          { date: "2024-01-15", available: true, price: 120 },
          { date: "2024-01-16", available: true, price: 120 },
          { date: "2024-01-17", available: false, price: 120 },
        ],
        totalRooms: 20,
        availableRooms: 15,
      },
      {
        id: "r2",
        category: "Supérieure",
        type: "Double",
        basePrice: 180,
        capacity: 2,
        size: 35,
        mealPlans: [
          { type: "breakfast", price: 0, included: true },
          { type: "halfBoard", price: 50, included: false },
          { type: "fullBoard", price: 90, included: false },
        ],
        availability: [
          { date: "2024-01-15", available: true, price: 180 },
          { date: "2024-01-16", available: true, price: 180 },
          { date: "2024-01-17", available: true, price: 200 },
        ],
        totalRooms: 15,
        availableRooms: 8,
      },
      {
        id: "r3",
        category: "Suite",
        type: "Suite",
        basePrice: 350,
        capacity: 4,
        size: 65,
        mealPlans: [
          { type: "breakfast", price: 0, included: true },
          { type: "halfBoard", price: 75, included: false },
          { type: "fullBoard", price: 130, included: false },
          { type: "allInclusive", price: 180, included: false },
        ],
        availability: [
          { date: "2024-01-15", available: true, price: 350 },
          { date: "2024-01-16", available: false, price: 350 },
          { date: "2024-01-17", available: true, price: 380 },
        ],
        totalRooms: 5,
        availableRooms: 3,
      },
    ],
    reviews: {
      total: 248,
      average: 4.5,
      breakdown: { 5: 156, 4: 62, 3: 20, 2: 7, 1: 3 },
    },
  },
];

const AMENITIES_ICONS = {
  wifi: Wifi,
  parking: Car,
  pool: Waves,
  gym: Dumbbell,
  restaurant: Utensils,
  security: Shield,
};

const MEAL_PLANS = {
  breakfast: { label: "Petit-déjeuner", icon: Coffee },
  halfBoard: { label: "Demi-pension", icon: Utensils },
  fullBoard: { label: "Pension complète", icon: Utensils },
  allInclusive: { label: "All inclusive", icon: Utensils },
};

// Composant Star Rating
const StarRating = ({ rating, maxStars = 5, size = 16, interactive = false, onRate }) => {
  const [hover, setHover] = useState(0);

  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: maxStars }).map((_, i) => {
        const starValue = i + 1;
        const filled = interactive ? (hover || rating) >= starValue : rating >= starValue;
        const halfFilled = !filled && rating >= starValue - 0.5;

        return (
          <Star
            key={i}
            size={size}
            onClick={() => interactive && onRate && onRate(starValue)}
            onMouseEnter={() => interactive && setHover(starValue)}
            onMouseLeave={() => interactive && setHover(0)}
            style={{
              cursor: interactive ? "pointer" : "default",
              fill: filled ? "#FBBF24" : "none",
              stroke: filled || halfFilled ? "#FBBF24" : "#CBD5E1",
              transition: "all 0.2s",
            }}
          />
        );
      })}
    </div>
  );
};

// Composant Badge
const Badge = ({ children, color = "primary", size = "md" }) => {
  const colors = {
    primary: { bg: T.primaryDim, text: T.primary, border: T.primary },
    success: { bg: "#D1FAE5", text: "#059669", border: "#10B981" },
    warning: { bg: "#FEF3C7", text: "#D97706", border: "#F59E0B" },
    danger: { bg: "#FEE2E2", text: "#DC2626", border: "#EF4444" },
    gray: { bg: T.lightGray, text: T.gray, border: "#CBD5E1" },
  };

  const sizes = {
    sm: { padding: "2px 6px", fontSize: "10px" },
    md: { padding: "4px 8px", fontSize: "11px" },
    lg: { padding: "6px 12px", fontSize: "12px" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: sizes[size].padding,
        fontSize: sizes[size].fontSize,
        fontWeight: 600,
        borderRadius: 6,
        backgroundColor: colors[color].bg,
        color: colors[color].text,
        border: `1px solid ${colors[color].border}`,
      }}
    >
      {children}
    </span>
  );
};

// Composant Modal
const Modal = ({ isOpen, onClose, title, children, size = "md" }) => {
  if (!isOpen) return null;

  const sizes = {
    sm: "400px",
    md: "600px",
    lg: "900px",
    xl: "1200px",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: sizes[size],
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              color: T.gray,
            }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
};

// Composant principal Hotel Manager
export default function HotelManager() {
  const [hotels, setHotels] = useState(INITIAL_HOTELS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view"); // view, edit, create
  const [activeTab, setActiveTab] = useState("overview"); // overview, rooms, pricing, reviews
  const [expandedRooms, setExpandedRooms] = useState({});
  const [filters, setFilters] = useState({
    city: "",
    minRating: 0,
    minStars: 0,
    priceRange: [0, 1000],
  });

  // Filtrage des hôtels
  const filteredHotels = useMemo(() => {
    return hotels.filter((hotel) => {
      const matchesSearch = hotel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hotel.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCity = !filters.city || hotel.city === filters.city;
      const matchesRating = hotel.rating >= filters.minRating;
      const matchesStars = hotel.stars >= filters.minStars;
      return matchesSearch && matchesCity && matchesRating && matchesStars;
    });
  }, [hotels, searchTerm, filters]);

  // Statistiques globales
  const stats = useMemo(() => {
    const totalRooms = hotels.reduce((acc, h) => acc + h.rooms.reduce((r, room) => r + room.totalRooms, 0), 0);
    const availableRooms = hotels.reduce((acc, h) => acc + h.rooms.reduce((r, room) => r + room.availableRooms, 0), 0);
    const avgRating = hotels.reduce((acc, h) => acc + h.rating, 0) / hotels.length || 0;
    const totalRevenue = hotels.reduce((acc, h) => 
      acc + h.rooms.reduce((r, room) => r + (room.basePrice * room.totalRooms), 0), 0
    );

    return { totalHotels: hotels.length, totalRooms, availableRooms, avgRating, totalRevenue };
  }, [hotels]);

  // Handlers
  const handleAddHotel = () => {
    setModalMode("create");
    setSelectedHotel(null);
    setIsModalOpen(true);
  };

  const handleEditHotel = (hotel) => {
    setModalMode("edit");
    setSelectedHotel(hotel);
    setIsModalOpen(true);
  };

  const handleViewHotel = (hotel) => {
    setModalMode("view");
    setSelectedHotel(hotel);
    setActiveTab("overview");
    setIsModalOpen(true);
  };

  const handleDeleteHotel = (hotelId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet hôtel ?")) {
      setHotels(hotels.filter((h) => h.id !== hotelId));
    }
  };

  const handleSaveHotel = (hotelData) => {
    if (modalMode === "create") {
      const newHotel = { ...hotelData, id: Date.now().toString() };
      setHotels([...hotels, newHotel]);
    } else {
      setHotels(hotels.map((h) => (h.id === hotelData.id ? hotelData : h)));
    }
    setIsModalOpen(false);
  };

  const toggleRoomExpansion = (roomId) => {
    setExpandedRooms((prev) => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  return (
    <div style={{ padding: 24, backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>
          Gestion Hôtelière
        </h1>
        <p style={{ color: T.gray, margin: 0 }}>Gérez vos hôtels, chambres, tarifs et disponibilités</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <StatCard icon={Hotel} label="Total Hôtels" value={stats.totalHotels} color={T.primary} />
        <StatCard icon={Bed} label="Chambres Totales" value={stats.totalRooms} color={T.secondary} />
        <StatCard icon={CheckCircle} label="Disponibles" value={stats.availableRooms} color={T.success} />
        <StatCard icon={Star} label="Note Moyenne" value={stats.avgRating.toFixed(1)} color="#FBBF24" />
        <StatCard icon={DollarSign} label="Revenu Potentiel" value={`${stats.totalRevenue.toLocaleString()}€`} color={T.accent} />
      </div>

      {/* Filters & Search */}
      <div style={{ 
        backgroundColor: "#fff", 
        padding: 20, 
        borderRadius: 12, 
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 250, position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.gray }} />
            <input
              type="text"
              placeholder="Rechercher un hôtel ou une ville..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px 10px 40px",
                border: "1.5px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
          <select
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            style={{ padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}
          >
            <option value="">Toutes les villes</option>
            {["Pékin", "Paris", "Londres", "New York"].map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <select
            value={filters.minRating}
            onChange={(e) => setFilters({ ...filters, minRating: Number(e.target.value) })}
            style={{ padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14 }}
          >
            <option value={0}>Toutes notes</option>
            <option value={4}>4+ étoiles</option>
            <option value={4.5}>4.5+ étoiles</option>
          </select>
          <button
            onClick={handleAddHotel}
            style={{
              padding: "10px 20px",
              backgroundColor: T.primary,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <Plus size={18} />
            Nouvel Hôtel
          </button>
        </div>
      </div>

      {/* Hotels Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 20 }}>
        {filteredHotels.map((hotel) => (
          <HotelCard
            key={hotel.id}
            hotel={hotel}
            onView={() => handleViewHotel(hotel)}
            onEdit={() => handleEditHotel(hotel)}
            onDelete={() => handleDeleteHotel(hotel.id)}
          />
        ))}
      </div>

      {/* Hotel Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "Nouvel Hôtel" : selectedHotel?.name}
        size="xl"
      >
        {selectedHotel && (
          <HotelDetail
            hotel={selectedHotel}
            mode={modalMode}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSave={handleSaveHotel}
            onUpdate={(updatedHotel) => {
              setHotels(hotels.map((h) => (h.id === updatedHotel.id ? updatedHotel : h)));
              setSelectedHotel(updatedHotel);
            }}
            expandedRooms={expandedRooms}
            onToggleRoom={toggleRoomExpansion}
          />
        )}
      </Modal>
    </div>
  );
}

// Composant Stat Card
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      backgroundColor: "#fff",
      padding: 20,
      borderRadius: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: `${color}20`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: color,
      }}>
        <Icon size={24} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#1e293b" }}>{value}</div>
        <div style={{ fontSize: 13, color: T.gray, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

// Composant Hotel Card
function HotelCard({ hotel, onView, onEdit, onDelete }) {
  const totalRooms = hotel.rooms.reduce((acc, r) => acc + r.totalRooms, 0);
  const availableRooms = hotel.rooms.reduce((acc, r) => acc + r.availableRooms, 0);
  const occupancyRate = ((totalRooms - availableRooms) / totalRooms * 100).toFixed(0);

  return (
    <div style={{
      backgroundColor: "#fff",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}>
      <div style={{
        height: 180,
        backgroundImage: `url(${hotel.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}>
        <div style={{
          position: "absolute",
          top: 12,
          right: 12,
          backgroundColor: "#fff",
          padding: "4px 8px",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontWeight: 600,
          fontSize: 13,
        }}>
          <Star size={14} style={{ fill: "#FBBF24", stroke: "#FBBF24" }} />
          {hotel.rating.toFixed(1)}
        </div>
        <div style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 12,
        }}>
          {Array.from({ length: hotel.stars }).map((_, i) => (
            <Star key={i} size={12} style={{ fill: "#FBBF24", stroke: "#FBBF24", display: "inline" }} />
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600 }}>{hotel.name}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.gray, marginBottom: 12, fontSize: 13 }}>
          <MapPin size={14} />
          {hotel.city}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Badge color="primary">{totalRooms} chambres</Badge>
          <Badge color="success">{availableRooms} dispo</Badge>
          <Badge color={occupancyRate > 80 ? "warning" : "success"}>
            {occupancyRate}% occup.
          </Badge>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onView}
            style={{
              flex: 1,
              padding: 8,
              backgroundColor: T.primaryDim,
              color: T.primary,
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Voir détails
          </button>
          <button
            onClick={onEdit}
            style={{
              padding: 8,
              backgroundColor: T.lightGray,
              color: T.gray,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <Edit size={16} />
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: 8,
              backgroundColor: "#FEE2E2",
              color: "#DC2626",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Composant Hotel Detail
function HotelDetail({ hotel, mode, activeTab, onTabChange, onSave, expandedRooms, onToggleRoom }) {
  const [editedHotel, setEditedHotel] = useState(hotel);

  const tabs = [
    { key: "overview", label: "Vue d'ensemble", icon: Hotel },
    { key: "rooms", label: "Chambres", icon: Bed },
    { key: "pricing", label: "Tarification", icon: DollarSign },
    { key: "availability", label: "Disponibilités", icon: Calendar },
    { key: "reviews", label: "Avis", icon: Star },
  ];

  if (mode === "create" || mode === "edit") {
    return (
      <HotelForm
        hotel={editedHotel}
        onChange={setEditedHotel}
        onSave={() => onSave(editedHotel)}
        onCancel={() => {}}
      />
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e2e8f0", marginBottom: 24 }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              style={{
                padding: "12px 20px",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${T.primary}` : "2px solid transparent",
                color: activeTab === tab.key ? T.primary : T.gray,
                fontWeight: activeTab === tab.key ? 600 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                marginBottom: -2,
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab hotel={hotel} />}
      {activeTab === "rooms" && <RoomsTab hotel={hotel} expandedRooms={expandedRooms} onToggle={onToggleRoom} />}
      {activeTab === "pricing" && <PricingTab hotel={hotel} />}
      {activeTab === "availability" && <AvailabilityTab hotel={hotel} />}
      {activeTab === "reviews" && <ReviewsTab hotel={hotel} />}
    </div>
  );
}

// Composant Formulaire Hôtel
function HotelForm({ hotel, onChange, onSave, onCancel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormField label="Nom de l'hôtel" required>
          <input
            type="text"
            value={hotel.name || ""}
            onChange={(e) => onChange({ ...hotel, name: e.target.value })}
            style={inputStyle}
            placeholder="Ex: Grand Hôtel"
          />
        </FormField>
        <FormField label="Ville" required>
          <input
            type="text"
            value={hotel.city || ""}
            onChange={(e) => onChange({ ...hotel, city: e.target.value })}
            style={inputStyle}
            placeholder="Ex: Paris"
          />
        </FormField>
        <FormField label="Adresse">
          <input
            type="text"
            value={hotel.address || ""}
            onChange={(e) => onChange({ ...hotel, address: e.target.value })}
            style={inputStyle}
          />
        </FormField>
        <FormField label="Nombre d'étoiles">
          <select
            value={hotel.stars || 3}
            onChange={(e) => onChange({ ...hotel, stars: Number(e.target.value) })}
            style={inputStyle}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n} étoile{n > 1 ? "s" : ""}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
        <button onClick={onCancel} style={cancelButtonStyle}>Annuler</button>
        <button onClick={onSave} style={saveButtonStyle}>
          <Save size={16} />
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// Tabs Components
function OverviewTab({ hotel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <InfoCard label="Total Chambres" value={hotel.rooms.reduce((acc, r) => acc + r.totalRooms, 0)} icon={Bed} color={T.primary} />
        <InfoCard label="Disponibles" value={hotel.rooms.reduce((acc, r) => acc + r.availableRooms, 0)} icon={CheckCircle} color={T.success} />
        <InfoCard label="Note Moyenne" value={hotel.rating.toFixed(1) + "/5"} icon={Star} color="#FBBF24" />
        <InfoCard label="Total Avis" value={hotel.reviews.total} icon={Users} color={T.secondary} />
      </div>

      <div>
        <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Commodités</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hotel.amenities.map((amenity) => {
            const Icon = AMENITIES_ICONS[amenity] || Hotel;
            return (
              <Badge key={amenity} color="gray">
                <Icon size={12} />
                {amenity}
              </Badge>
            );
          })}
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Répartition des chambres</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hotel.rooms.map((room) => (
            <div key={room.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, backgroundColor: T.lightGray, borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{room.category} - {room.type}</div>
                <div style={{ fontSize: 12, color: T.gray }}>{room.availableRooms}/{room.totalRooms} disponibles</div>
              </div>
              <div style={{ fontWeight: 700, color: T.primary }}>{room.basePrice}€</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomsTab({ hotel, expandedRooms, onToggle }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {hotel.rooms.map((room) => (
        <div key={room.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
          <div
            onClick={() => onToggle(room.id)}
            style={{
              padding: 16,
              backgroundColor: expandedRooms[room.id] ? T.primaryDim : "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Bed size={20} style={{ color: T.primary }} />
              <div>
                <div style={{ fontWeight: 600 }}>{room.category} - {room.type}</div>
                <div style={{ fontSize: 12, color: T.gray }}>{room.capacity} pers. • {room.size}m²</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Badge color={room.availableRooms > 0 ? "success" : "danger"}>
                {room.availableRooms}/{room.totalRooms} dispo
              </Badge>
              <div style={{ fontWeight: 700, color: T.primary }}>{room.basePrice}€</div>
              {expandedRooms[room.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>

          {expandedRooms[room.id] && (
            <div style={{ padding: 16, backgroundColor: "#fff" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                <div>
                  <h5 style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: T.gray }}>Plans de restauration</h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {room.mealPlans.map((plan) => {
                      const MealIcon = MEAL_PLANS[plan.type]?.icon || Utensils;
                      return (
                        <div key={plan.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, backgroundColor: plan.included ? T.tealDim : T.lightGray, borderRadius: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <MealIcon size={14} style={{ color: T.secondary }} />
                            <span style={{ fontSize: 13 }}>{MEAL_PLANS[plan.type]?.label}</span>
                            {plan.included && <Badge color="success" size="sm">Inclus</Badge>}
                          </div>
                          <span style={{ fontWeight: 600 }}>+{plan.price}€</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h5 style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: T.gray }}>Disponibilité récente</h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {room.availability.slice(0, 5).map((day) => (
                      <div key={day.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, backgroundColor: day.available ? T.tealDim : "#FEE2E2", borderRadius: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {day.available ? <CheckCircle size={14} style={{ color: T.success }} /> : <XCircle size={14} style={{ color: T.accent }} />}
                          <span style={{ fontSize: 13 }}>{new Date(day.date).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <span style={{ fontWeight: 600 }}>{day.price}€</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PricingTab({ hotel }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Grille tarifaire par catégorie</h4>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hotel.rooms.map((room) => (
          <div key={room.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, padding: 12, backgroundColor: T.lightGray, borderRadius: 8, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{room.category} - {room.type}</div>
              <div style={{ fontSize: 12, color: T.gray }}>{room.capacity} personnes • {room.size}m²</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: T.gray }}>Prix de base</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: T.primary }}>{room.basePrice}€</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: T.gray }}>Prix min</div>
              <div style={{ fontWeight: 600 }}>{Math.min(...room.availability.map(a => a.price))}€</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: T.gray }}>Prix max</div>
              <div style={{ fontWeight: 600 }}>{Math.max(...room.availability.map(a => a.price))}€</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AvailabilityTab({ hotel }) {
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ padding: 12, textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>Chambre</th>
              {next7Days.map((date) => (
                <th key={date} style={{ padding: 12, textAlign: "center", borderBottom: "2px solid #e2e8f0", fontSize: 12 }}>
                  {new Date(date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hotel.rooms.map((room) => (
              <tr key={room.id}>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 600 }}>{room.category}</div>
                  <div style={{ fontSize: 12, color: T.gray }}>{room.type}</div>
                </td>
                {next7Days.map((date) => {
                  const dayAvailability = room.availability.find((a) => a.date === date);
                  const available = dayAvailability?.available ?? false;
                  const price = dayAvailability?.price ?? room.basePrice;
                  
                  return (
                    <td key={date} style={{ padding: 8, textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        backgroundColor: available ? T.tealDim : "#FEE2E2",
                        color: available ? T.tealDark : T.accent,
                        fontWeight: 600,
                        fontSize: 12,
                      }}>
                        {available ? `${price}€` : "Complet"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewsTab({ hotel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: T.primary }}>{hotel.rating.toFixed(1)}</div>
          <StarRating rating={hotel.rating} size={20} />
          <div style={{ fontSize: 13, color: T.gray, marginTop: 4 }}>{hotel.reviews.total} avis</div>
        </div>
        <div style={{ flex: 1, maxWidth: 400 }}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = hotel.reviews.breakdown[stars] || 0;
            const percentage = (count / hotel.reviews.total) * 100;
            return (
              <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, width: 30 }}>{stars}★</span>
                <div style={{ flex: 1, height: 8, backgroundColor: T.lightGray, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${percentage}%`, height: "100%", backgroundColor: T.primary, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, color: T.gray, width: 40 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
        <h4 style={{ marginBottom: 16 }}>Avis récents</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ padding: 16, backgroundColor: T.lightGray, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: T.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600 }}>
                    {String.fromCharCode(64 + i)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Client {i}</div>
                    <div style={{ fontSize: 12, color: T.gray }}>Il y a {i * 2} jours</div>
                  </div>
                </div>
                <StarRating rating={5 - i * 0.5} size={14} />
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                Excellent séjour dans cet hôtel. Le personnel est très accueillant et les chambres sont impeccables. 
                Je recommande vivement !
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function FormField({ label, children, required }) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
        {label} {required && <span style={{ color: T.accent }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function InfoCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ padding: 16, backgroundColor: T.lightGray, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        <Icon size={20} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
        <div style={{ fontSize: 12, color: T.gray }}>{label}</div>
      </div>
    </div>
  );
}

// Styles
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

const saveButtonStyle = {
  padding: "10px 24px",
  backgroundColor: T.primary,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
};

const cancelButtonStyle = {
  padding: "10px 24px",
  backgroundColor: T.lightGray,
  color: T.gray,
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};
