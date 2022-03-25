const general = {
    pri_key: 'String',
    sort_key: 'String',
};
const user = {
    user_id: 'String',
    password: 'String',
    email: 'String',
    api_token: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    username: 'String', // added by adrhee2020
    first_name: 'String',
    last_name: 'String',
    birth: 'String',
    phone_number: 'String',
    photo_url: 'String',
    city: 'String',
    location_state: 'String', // reversed key
    country: 'String',
    address: 'String',
    user_role: 'String',
    short_bio: 'String',
    job: 'String',
    company: 'String',
    fcm_token: 'String',
    call_token: 'String',
    industry: 'String',
    table_name: 'String', /// added by ftf
    forgot_token: 'String',
    verified: 'Boolean',
    approved: 'Boolean',
    loggedin: 'Boolean',
    web_site: 'String',
    twitter_url: 'String',
    linkedin_url: 'String',
    time_zone: 'String',
    likes_gained: 'Number',
    sort_type: 'String',
    presence: 'String',
    onboarding: 'String'
};

const user_connect = {
    created_at: 'Date',
    updated_at: 'Date',
};

const assemble = {
    assemble_id: 'String',
    assemble_name: 'String',
    user_id: 'String',
    user_name: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    extra_name: 'String',
    is_immediately: 'Boolean',
    is_started: 'Boolean',
    start_time: 'Date',
    end_time: 'Date',
    photo_url: 'String',
    is_private: 'Boolean',
    members: 'Number',
    likes_gained: 'Number',
    /// added by ftf
    event_id: 'String',
    enter_club_id: 'String',
    enter_club_name: 'String',
    table_name: 'String',
    host_id: 'String',
    host_name: 'String',
    is_ended: 'Boolean', // ended checking,
    is_allow_all: 'Boolean',
    is_enter_stage: 'Boolean',
    selected_users: 'Array',
    send_notification: 'Boolean',
    description: 'String',
    notify_users: 'Array',
    is_pinned: 'Boolean',
    pinned_at: 'Date',
    /// added by adrhee June 28th
    membership: 'String',
};

const assemble_connect = {
    created_at: 'Date',
    updated_at: 'Date',
};

const event = {
    event_id: 'String',
    event_name: 'String',
    description: 'String',
    link: 'String',
    photo_url: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    event_time: 'Date',
    enter_club_id: 'String',
    enter_club_name: 'String',
    table_name: 'String',
    host_id: 'String',
    host_name: 'String',
    send_notification: 'Boolean',
    notify_users: 'Array',
};

const help_audio = {
    club_id: 'String',
    audio_id: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    audio_url: 'String',
    audio_duration: 'Number',
    description: 'String',
};

const tutor_audio = {
    audio_url: 'String',
    audio_duration: 'Number',
    audio_file_name: 'String',
    table_name: 'String',
};

const audio = {
    audio_id: 'String',
    audio_name: 'String',
    description: 'String',
    user_id: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    photo_url: 'String',
    audio_url: 'String',
    audio_duration: 'Number',
    audio_file_name: 'String',
    is_private: 'Boolean',
    notify_content: 'String',
    members: 'Number',
    likes_gained: 'Number',
    /// added by ftf
    enter_club_id: 'String',
    enter_club_name: 'String',
    table_name: 'String',
    host_id: 'String',
    host_name: 'String',
    is_ended: 'Boolean', // ended checking
    from_user: 'Boolean', // ended checking
    selected_users: 'Array',
    is_allow_all: 'Boolean',
    is_pinned: 'Boolean',
    pinned_at: 'Date',
    is_sent_message: 'Boolean',
    audio_status: 'String',
    reject_reason: 'String'
};
const audio_indexing = {
    table_name: 'String',
    start_time: 'String',
    description: 'String',
    created_at: 'Date',
    updated_at: 'Date',
};
const audio_track = {
    table_name: 'String',
    play_time: 'String',
    created_at: 'Date',
    updated_at: 'Date',
};
const audio_connect = {
    created_at: 'Date',
    updated_at: 'Date',
};

const voice_note = {
    voicenote_id: 'String',
    description: 'String',
    receiver_id: 'String',
    user_id: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    audio_url: 'String',
    is_private: 'Boolean',
    audio_duration: 'Number',
    audio_file_name: 'String',
    likes_gained: 'Number',
    enter_club_id: 'String',
    enter_club_name: 'String',
    table_name: 'String',
    from_manager: 'Boolean',
    hello_audio_id: 'String', // from audio
};

const voice_note_connect = {
    created_at: 'Date',
    updated_at: 'Date',
};

const club = {
    club_id: 'String',
    club_name: 'String',
    extra_name: 'String',
    memebership: 'String',
    description: 'String',
    user_id: 'String',
    isdue: 'Boolean',
    created_at: 'Date',
    updated_at: 'Date',
    photo_url: 'String',
    /// added by ftf
    banner_url: 'String',
    assemble_photo_url: 'String',
    web_banner_url: 'String',
    voice_photo_url: 'String',
    time_zone: 'String',
    members: 'Number',
    table_name: 'String',
    is_private: 'Boolean',
    access_code: 'String',
    is_connect_stripe: 'Boolean',

    /// added by adrhee2020 June 24th
    is_visible: 'Boolean',
    minimum_number: 'Number',
    maximum_number: 'Number',
};

const club_tier = {
    clubtier_id: 'String',
    clubtier_name: 'String',
    price: 'Number',
    price_id: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    table_name: 'String',
};

const email_template = {
    template_id: 'String',
    is_send: 'Boolean',
    content: 'String',
    type: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    table_name: 'String',
};

const club_images = {
    club_id: 'String',
    photo_url: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    table_name: 'String',
};

const club_request = {
    club_id: 'String',
    club_name: 'String',
    access_code: 'String',
    is_private: 'Boolean',
    user_id: 'String',
    first_name: 'String',
    last_name: 'String',
    phone_number: 'String',
    photo_url: 'String',
    is_approved: 'Boolean',
    created_at: 'Date',
    updated_at: 'Date',
    table_name: 'String',
};

const club_connect = {
    created_at: 'Date',
    updated_at: 'Date',
};

const group = {
    group_id: 'String',
    group_name: 'String',
    description: 'String',
    user_id: 'String',
    created_at: 'Date',
    updated_at: 'Date',
    time_zone: 'String',
    members: 'Number',
    table_name: 'String',
    coupon_code: 'String',
    is_connect_stripe: 'Boolean',
};

const group_connect = {
    created_at: 'Date',
    updated_at: 'Date',
};

const viewer = {
    viewer_id: 'String',
    handup: 'Boolean',
    handselect: 'Boolean',
    muted: 'Boolean',
    joined_at: 'Date',
    created_at: 'Date',
    updated_at: 'Date',
    user_id: 'String',
    channel_id: 'String',
    agora_uid: 'String',
    first_name: 'String',
    last_name: 'String',
    photo_url: 'String',
    host_allow: 'Boolean',
    table_name: 'String',
};

const vcode = {
    pcode: 'String',
    ecode: 'String',
    email: 'String',
    phone: 'String',
    createdAt: 'Date',
    expireIn: 'Date',
};

const acode = {
    acode: 'String',
    email: 'String',
    phone: 'String',
    is_used: 'Boolean',
    createdAt: 'Date',
    updatedAt: 'Date',
};

const count_tbl = {
    table_count: 'Number',
    createdAt: 'Date',
    updatedAt: 'Date',
};

const stripeConnect = {
    access_token: 'String',
    livemode: 'Boolean',
    refresh_token: 'String',
    stripe_publishable_key: 'String',
    stripe_user_id: 'String',
    table_name: 'String',
};

const customerConnect = {
    customer_name: 'String',
    customer_email: 'String',
    customer_id: 'String',
    subscription_id: 'String',
    table_name: 'String',
};

const memberReferral = {
    referral_user_id: 'String',
    referral_user_name: 'String',
    referral_club_id: 'String',
    referral_club_name: 'String',
    referral_id: 'String',
    referral_email: 'String',
    referral_name: 'String',
    referral_phone: 'String',
    referral_linkedin: 'String',
    referral_info: 'String',
    table_name: 'String',
};

module.exports = {
    general,
    user,
    user_connect,
    assemble,
    assemble_connect,
    event,
    audio,
    audio_connect,
    audio_indexing,
    audio_track,
    club,
    club_tier,
    email_template,
    club_connect,
    club_request,
    group,
    group_connect,
    viewer,
    acode,
    vcode,
    help_audio,
    count_tbl,
    voice_note,
    tutor_audio,
    stripeConnect,
    customerConnect,
    memberReferral,
    club_images,
};
