-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Feb 28, 2026 at 09:05 PM
-- Server version: 8.0.44-cll-lve
-- PHP Version: 8.4.17

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `desilope_softaware`
--

-- --------------------------------------------------------

--
-- Table structure for table `sys_audit_logs`
--

CREATE TABLE `sys_audit_logs` (
  `id` int NOT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `old_values` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `new_values` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_audit_logs`
--

INSERT INTO `sys_audit_logs` (`id`, `action`, `entity_type`, `entity_id`, `user_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"39\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 20:25:57'),
(2, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"38\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 20:26:04'),
(3, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"36\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 20:26:11'),
(4, 'update', 'user', 2, NULL, '{\"id\":2,\"username\":\"user\",\"email\":\"sales@software.co.za\",\"first_name\":\"Regular\",\"last_name\":\"User\",\"is_active\":true,\"is_admin\":false,\"created_at\":\"2025-11-08 21:22:31\",\"updated_at\":\"2025-11-08 21:22:31\",\"role_name\":\"Editor\",\"role_slug\":\"editor\"}', '{\"id\":2,\"username\":\"user\",\"email\":\"sales@software.co.za\",\"first_name\":\"Regular\",\"last_name\":\"User\",\"is_active\":true,\"is_admin\":false,\"created_at\":\"2025-11-08 21:22:31\",\"updated_at\":\"2025-11-10 23:02:48\",\"role_name\":\"Editor\",\"role_slug\":\"editor\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 21:02:48'),
(5, 'update', 'user', 2, NULL, '{\"id\":2,\"username\":\"user\",\"email\":\"sales@software.co.za\",\"first_name\":\"Regular\",\"last_name\":\"User\",\"is_active\":true,\"is_admin\":false,\"created_at\":\"2025-11-08 21:22:31\",\"updated_at\":\"2025-11-10 23:02:48\",\"role_name\":\"Editor\",\"role_slug\":\"editor\"}', '{\"id\":2,\"username\":\"user\",\"email\":\"sales@software.co.za\",\"first_name\":\"Regular\",\"last_name\":\"User\",\"is_active\":true,\"is_admin\":false,\"created_at\":\"2025-11-08 21:22:31\",\"updated_at\":\"2025-11-10 23:04:01\",\"role_name\":\"Editor\",\"role_slug\":\"editor\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 21:04:01'),
(6, 'assign_role', 'user', 2, NULL, NULL, '{\"role_id\":\"2\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 21:04:02'),
(7, 'create', 'user', 19, NULL, NULL, '{\"id\":19,\"username\":\"tester\",\"email\":\"tester@example.com\",\"first_name\":\"T\",\"last_name\":\"S\",\"is_active\":true,\"is_admin\":false,\"created_at\":\"2025-11-10 23:13:02\",\"updated_at\":null,\"role_name\":null,\"role_slug\":null}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 21:13:02'),
(8, 'assign_role', 'user', 19, NULL, NULL, '{\"role_id\":\"2\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 21:13:03'),
(9, 'remove_permission', 'role', 2, NULL, '{\"permission_id\":\"37\"}', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 21:19:37'),
(10, 'update', 'setting', 23, NULL, '{\"id\":23,\"key\":\"software_key\",\"value\":\"TEST123\",\"type\":\"string\",\"description\":\"Test description\",\"is_public\":0,\"created_at\":\"2025-11-11 00:50:09\",\"updated_at\":\"2025-11-11 08:34:24\"}', '{\"id\":23,\"key\":\"software_key\",\"value\":\"20251001SILU\",\"type\":\"string\",\"description\":\"Software key for update server authentication\",\"is_public\":0,\"created_at\":\"2025-11-11 00:50:09\",\"updated_at\":\"2025-11-11 08:37:45\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.6899', '2025-11-11 06:37:45'),
(11, 'update', 'setting', 23, NULL, '{\"id\":23,\"key\":\"software_key\",\"value\":\"20251001SILU\",\"type\":\"string\",\"description\":\"Software key for update server authentication\",\"is_public\":0,\"created_at\":\"2025-11-11 00:50:09\",\"updated_at\":\"2025-11-11 08:37:45\"}', '{\"id\":23,\"key\":\"software_key\",\"value\":\"20251111API\",\"type\":\"string\",\"description\":\"Software key for update server authentication\",\"is_public\":0,\"created_at\":\"2025-11-11 00:50:09\",\"updated_at\":\"2025-11-11 08:38:02\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-11 06:38:02'),
(12, 'delete', 'setting', 20, NULL, '{\"id\":20,\"key\":\"vat_percentage\",\"value\":\"15\",\"type\":\"string\",\"description\":\"Default VAT percentage for invoices and quotations\",\"is_public\":1,\"created_at\":\"2025-11-09 19:48:04\",\"updated_at\":null}', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-11 06:47:56'),
(13, 'update', 'setting', 24, NULL, '{\"id\":24,\"key\":\"updates_url\",\"value\":\"\",\"type\":\"string\",\"description\":\"Update server URL (e.g., https:\\/\\/updates.example.com)\",\"is_public\":0,\"created_at\":\"2025-11-11 00:50:09\",\"updated_at\":null}', '{\"id\":24,\"key\":\"updates_url\",\"value\":\"https:\\/\\/updates.softaware.co.za\\/\",\"type\":\"string\",\"description\":\"Update server URL\",\"is_public\":0,\"created_at\":\"2025-11-11 00:50:09\",\"updated_at\":\"2025-11-11 09:35:24\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-11 07:35:24'),
(14, 'create', 'user', 2, NULL, NULL, '{\"id\":2,\"username\":\"Naledi\",\"email\":\"sales@softaware.co.za\",\"first_name\":\"Naledi\",\"last_name\":\"Nomsobo\",\"is_active\":true,\"is_admin\":false,\"created_at\":\"2025-11-21 20:05:59\",\"updated_at\":null,\"role_name\":null,\"role_slug\":null}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:05:59'),
(15, 'assign_role', 'user', 2, NULL, NULL, '{\"role_id\":\"2\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:05:59'),
(16, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"66\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:13'),
(17, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"35\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:17'),
(18, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"37\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:18'),
(19, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"36\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:19'),
(20, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"34\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:19'),
(21, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"70\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:22'),
(22, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"68\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:23'),
(23, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"72\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:24'),
(24, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"67\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:25'),
(25, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"71\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:25'),
(26, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"65\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:28'),
(27, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"64\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:29'),
(28, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"69\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:31'),
(29, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"63\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:32'),
(30, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"33\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:33'),
(31, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"60\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:35'),
(32, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"52\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:36'),
(33, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"56\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:38'),
(34, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"62\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:38'),
(35, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"54\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:39'),
(36, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"58\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:41'),
(37, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"61\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:42'),
(38, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"53\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:43'),
(39, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"57\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:44'),
(40, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"59\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:45'),
(41, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"51\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:48'),
(42, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"55\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:48'),
(43, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"76\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:54'),
(44, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"75\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:54'),
(45, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"11\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:06:57'),
(46, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"2\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:00'),
(47, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"4\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:01'),
(48, 'remove_permission', 'role', 2, NULL, '{\"permission_id\":\"11\"}', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:02'),
(49, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"11\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:03'),
(50, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"77\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:04'),
(51, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"73\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:05'),
(52, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"78\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:05'),
(53, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"74\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:07'),
(54, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"3\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:29'),
(55, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"6\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:31'),
(56, 'remove_permission', 'role', 2, NULL, '{\"permission_id\":\"4\"}', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:32'),
(57, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"5\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:07:55'),
(58, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"48\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:03'),
(59, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"42\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:03'),
(60, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"45\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:05'),
(61, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"39\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:06'),
(62, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"47\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:07'),
(63, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"41\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:08'),
(64, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"46\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:15'),
(65, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"40\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:16'),
(66, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"49\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:17'),
(67, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"43\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:18'),
(68, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"50\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:20'),
(69, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"44\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:21'),
(70, 'assign_permission', 'role', 2, NULL, NULL, '{\"permission_id\":\"38\"}', '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-21 18:08:22'),
(71, 'update', 'user', 2, NULL, '{\"id\":2,\"username\":\"Naledi\",\"email\":\"sales@softaware.co.za\",\"first_name\":\"Naledi\",\"last_name\":\"Nomsobo\",\"is_active\":true,\"is_admin\":false,\"created_at\":\"2025-11-21 20:05:59\",\"updated_at\":null,\"role_name\":\"Editor\",\"role_slug\":\"editor\"}', '{\"id\":2,\"username\":\"Naledi\",\"email\":\"sales@softaware.co.za\",\"first_name\":\"Naledi\",\"last_name\":\"Nomsobo\",\"is_active\":true,\"is_admin\":true,\"created_at\":\"2025-11-21 20:05:59\",\"updated_at\":\"2025-11-22 14:51:14\",\"role_name\":\"Editor\",\"role_slug\":\"editor\"}', '197.184.115.137', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0', '2025-11-22 12:51:14');

-- --------------------------------------------------------

--
-- Table structure for table `sys_credentials`
--

CREATE TABLE `sys_credentials` (
  `id` int NOT NULL,
  `service_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `credential_type` enum('api_key','password','token','oauth','ssh_key','certificate','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'api_key',
  `identifier` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Username, email, or key identifier',
  `credential_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Encrypted credential (password, API key, token, etc.)',
  `additional_data` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Encrypted JSON with extra fields (secret_key, client_id, etc.)',
  `environment` enum('development','staging','production','all') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'production',
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sys_installed_updates`
--

CREATE TABLE `sys_installed_updates` (
  `id` int NOT NULL,
  `update_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `downloaded_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `installed_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sys_migrations`
--

CREATE TABLE `sys_migrations` (
  `id` int NOT NULL,
  `update_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `migration_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `executed_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_migrations`
--

INSERT INTO `sys_migrations` (`id`, `update_id`, `migration_name`, `executed_at`) VALUES
(2, '21', 'add_notifications.sql', '2025-11-11 14:51:49'),
(3, '21', 'add_updates_system.sql', '2025-11-11 14:51:49'),
(4, '21', 'ituran_mettax_schema.sql', '2025-11-11 14:51:49');

-- --------------------------------------------------------

--
-- Table structure for table `sys_notifications`
--

CREATE TABLE `sys_notifications` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `type` enum('info','success','warning','error','update') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'info' COMMENT 'Notification type',
  `is_read` tinyint(1) DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_notifications`
--

INSERT INTO `sys_notifications` (`id`, `user_id`, `title`, `message`, `data`, `type`, `is_read`, `read_at`, `created_at`) VALUES
(1, 1, 'Update Available: 1.0.2', '<div>&nbsp;Test migration that adds a new notification type and updates a setting<br></div>', '{\"version\": \"1.0.2\", \"update_id\": 21, \"action_url\": \"/system/updates\", \"released_at\": null}', 'info', 0, NULL, '2025-11-22 12:49:34');

-- --------------------------------------------------------

--
-- Table structure for table `sys_notification_preferences`
--

CREATE TABLE `sys_notification_preferences` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `channel` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `settings` json DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sys_notification_queue`
--

CREATE TABLE `sys_notification_queue` (
  `id` int NOT NULL,
  `channel` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipients` json NOT NULL,
  `subject` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `attempts` int DEFAULT '0',
  `last_attempt` timestamp NULL DEFAULT NULL,
  `error` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sys_notification_templates`
--

CREATE TABLE `sys_notification_templates` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sys_password_resets`
--

CREATE TABLE `sys_password_resets` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp` varchar(6) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_password_resets`
--

INSERT INTO `sys_password_resets` (`id`, `user_id`, `email`, `otp`, `expires_at`, `used`, `created_at`) VALUES
(1, 1, 'admin@example.com', '460262', '2025-11-21 14:55:06', 0, '2025-11-21 14:40:06'),
(2, 1, 'admin@example.com', '176447', '2025-11-21 14:57:41', 1, '2025-11-21 14:42:41');

-- --------------------------------------------------------

--
-- Table structure for table `sys_permissions`
--

CREATE TABLE `sys_permissions` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permission_group` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_permissions`
--

INSERT INTO `sys_permissions` (`id`, `name`, `slug`, `description`, `permission_group`, `created_at`, `updated_at`) VALUES
(1, 'View Users', 'view-users', 'Can view user list', NULL, '2025-11-11 15:00:20', NULL),
(2, 'Create Users', 'create-users', 'Can create new users', NULL, '2025-11-11 15:00:20', NULL),
(3, 'Edit Users', 'edit-users', 'Can edit existing users', NULL, '2025-11-11 15:00:20', NULL),
(4, 'Delete Users', 'delete-users', 'Can delete users', NULL, '2025-11-11 15:00:20', NULL),
(5, 'Manage Roles', 'manage-roles', 'Can manage roles', NULL, '2025-11-11 15:00:20', NULL),
(6, 'Manage Permissions', 'manage-permissions', 'Can manage permissions', NULL, '2025-11-11 15:00:20', NULL),
(7, 'Manage Settings', 'manage-settings', 'Can manage system settings', NULL, '2025-11-11 15:00:20', NULL),
(8, 'View Content', 'view-content', 'Can view content', NULL, '2025-11-11 15:00:20', NULL),
(9, 'Create Content', 'create-content', 'Can create content', NULL, '2025-11-11 15:00:20', NULL),
(10, 'Edit Content', 'edit-content', 'Can edit content', NULL, '2025-11-11 15:00:20', NULL),
(11, 'Delete Content', 'delete-content', 'Can delete content', NULL, '2025-11-11 15:00:20', NULL),
(12, 'View Users', 'users.view', 'Can view Users and Users details', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(13, 'Create Users', 'users.create', 'Can create new Users', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(14, 'Edit Users', 'users.edit', 'Can edit existing Users', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(15, 'Delete Users', 'users.delete', 'Can delete Users', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(16, 'View Roles', 'roles.view', 'Can view Roles and Roles details', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(17, 'Create Roles', 'roles.create', 'Can create new Roles', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(18, 'Edit Roles', 'roles.edit', 'Can edit existing Roles', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(19, 'Delete Roles', 'roles.delete', 'Can delete Roles', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(20, 'Assign Roles', 'roles.assign', 'Can assign roles to users', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(21, 'View Permissions', 'permissions.view', 'Can view Permissions and Permissions details', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(22, 'Create Permissions', 'permissions.create', 'Can create new Permissions', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(23, 'Edit Permissions', 'permissions.edit', 'Can edit existing Permissions', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(25, 'Delete Permissions', 'permissions.delete', 'Can delete Permissions', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(26, 'Assign Permissions', 'permissions.assign', 'Can assign permissions to roles', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(27, 'View System Settings', 'settings.view', 'Can view System Settings and System Settings details', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(28, 'Edit System Settings', 'settings.edit', 'Can edit existing System Settings', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(29, 'View Credentials', 'credentials.view', 'Can view Credentials and Credentials details', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(30, 'Create Credentials', 'credentials.create', 'Can create new Credentials', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(31, 'Edit Credentials', 'credentials.edit', 'Can edit existing Credentials', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(32, 'Delete Credentials', 'credentials.delete', 'Can delete Credentials', 'System', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(33, 'View Dashboard', 'dashboard.view', 'Can view the main dashboard', 'Dashboard', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(34, 'View Contacts', 'contacts.view', 'Can view Contacts and Contacts details', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:49'),
(35, 'Create Contacts', 'contacts.create', 'Can create new Contacts', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:49'),
(36, 'Edit Contacts', 'contacts.edit', 'Can edit existing Contacts', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:49'),
(37, 'Delete Contacts', 'contacts.delete', 'Can delete Contacts', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:49'),
(38, 'View Quotations', 'quotations.view', 'Can view Quotations and Quotations details', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:49'),
(39, 'Create Quotations', 'quotations.create', 'Can create new Quotations', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:49'),
(40, 'Edit Quotations', 'quotations.edit', 'Can edit existing Quotations', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:50'),
(41, 'Delete Quotations', 'quotations.delete', 'Can delete Quotations', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:50'),
(42, 'Approve Quotations', 'quotations.approve', 'Can approve/finalize Quotations', 'Business', '2025-11-21 20:05:18', '2025-11-21 20:13:50'),
(43, 'Email Quotations', 'quotations.email', 'Can email Quotations', 'Sales', '2025-11-21 20:05:18', '2025-11-21 20:05:18'),
(44, 'View Invoices', 'invoices.view', 'Can view Invoices and Invoices details', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(45, 'Create Invoices', 'invoices.create', 'Can create new Invoices', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(46, 'Edit Invoices', 'invoices.edit', 'Can edit existing Invoices', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(47, 'Delete Invoices', 'invoices.delete', 'Can delete Invoices', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(48, 'Approve Invoices', 'invoices.approve', 'Can approve/finalize Invoices', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(49, 'Email Invoices', 'invoices.email', 'Can email Invoices', 'Sales', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(50, 'Mark_paid Invoices', 'invoices.mark_paid', 'Can mark_paid Invoices', 'Sales', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(51, 'View Payments', 'payments.view', 'Can view Payments and Payments details', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(52, 'Create Payments', 'payments.create', 'Can create new Payments', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(53, 'Edit Payments', 'payments.edit', 'Can edit existing Payments', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(54, 'Delete Payments', 'payments.delete', 'Can delete Payments', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(55, 'View Transactions', 'transactions.view', 'Can view Transactions and Transactions details', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(56, 'Create Transactions', 'transactions.create', 'Can create new Transactions', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(57, 'Edit Transactions', 'transactions.edit', 'Can edit existing Transactions', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(58, 'Delete Transactions', 'transactions.delete', 'Can delete Transactions', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(59, 'View Expenses', 'expenses.view', 'Can view Expenses and Expenses details', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(60, 'Create Expenses', 'expenses.create', 'Can create new Expenses', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(61, 'Edit Expenses', 'expenses.edit', 'Can edit existing Expenses', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(62, 'Delete Expenses', 'expenses.delete', 'Can delete Expenses', 'Finance', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(63, 'View Pricing', 'pricing.view', 'Can view Pricing and Pricing details', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(64, 'Edit Pricing', 'pricing.edit', 'Can edit existing Pricing', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(65, 'View Categories', 'categories.view', 'Can view Categories and Categories details', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(66, 'Create Categories', 'categories.create', 'Can create new Categories', 'Configuration', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(67, 'Edit Categories', 'categories.edit', 'Can edit existing Categories', 'Business', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(68, 'Delete Categories', 'categories.delete', 'Can delete Categories', 'Configuration', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(69, 'View Expense Categories', 'expense_categories.view', 'Can view Expense Categories and Expense Categories details', 'Configuration', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(70, 'Create Expense Categories', 'expense_categories.create', 'Can create new Expense Categories', 'Configuration', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(71, 'Edit Expense Categories', 'expense_categories.edit', 'Can edit existing Expense Categories', 'Configuration', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(72, 'Delete Expense Categories', 'expense_categories.delete', 'Can delete Expense Categories', 'Configuration', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(73, 'View Reports', 'reports.view', 'Can access reports section', 'Reports', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(74, 'View VAT Reports', 'reports.vat', 'Can view and generate VAT reports', 'Reports', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(75, 'View Financial Reports', 'reports.financial', 'Can view financial reports and statements', 'Reports', '2025-11-21 20:05:19', '2025-11-21 20:13:50'),
(76, 'View Balance Sheet', 'reports.balance_sheet', 'Can view balance sheet report', 'Reports', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(77, 'View Profit & Loss', 'reports.profit_loss', 'Can view profit and loss statement', 'Reports', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(78, 'View Transaction Listing', 'reports.transaction_listing', 'Can view detailed transaction register', 'Reports', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(79, 'View Application Settings', 'app_settings.view', 'Can view Application Settings and Application Settings details', 'Settings', '2025-11-21 20:05:19', '2025-11-21 20:05:19'),
(80, 'Edit Application Settings', 'app_settings.edit', 'Can edit existing Application Settings', 'Settings', '2025-11-21 20:05:19', '2025-11-21 20:05:19');

-- --------------------------------------------------------

--
-- Stand-in structure for view `sys_permissions_with_roles_count`
-- (See below for the actual view)
--
CREATE TABLE `sys_permissions_with_roles_count` (
`created_at` datetime
,`description` varchar(255)
,`id` int
,`name` varchar(100)
,`roles_count` bigint
,`slug` varchar(100)
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Table structure for table `sys_roles`
--

CREATE TABLE `sys_roles` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_roles`
--

INSERT INTO `sys_roles` (`id`, `name`, `slug`, `description`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'administrator', 'Full system access', '2025-11-11 15:00:20', NULL),
(2, 'Editor', 'editor', 'Can create and edit content', '2025-11-11 15:00:20', NULL),
(3, 'Viewer', 'viewer', 'Can only view content', '2025-11-11 15:00:20', NULL);

-- --------------------------------------------------------

--
-- Stand-in structure for view `sys_roles_with_permissions_count`
-- (See below for the actual view)
--
CREATE TABLE `sys_roles_with_permissions_count` (
`created_at` datetime
,`description` varchar(255)
,`id` int
,`name` varchar(100)
,`permissions_count` bigint
,`slug` varchar(100)
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Table structure for table `sys_role_permissions`
--

CREATE TABLE `sys_role_permissions` (
  `id` int NOT NULL,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_role_permissions`
--

INSERT INTO `sys_role_permissions` (`id`, `role_id`, `permission_id`, `created_at`) VALUES
(1, 1, 9, '2025-11-11 15:00:20'),
(2, 1, 2, '2025-11-11 15:00:20'),
(3, 1, 11, '2025-11-11 15:00:20'),
(4, 1, 4, '2025-11-11 15:00:20'),
(5, 1, 10, '2025-11-11 15:00:20'),
(6, 1, 3, '2025-11-11 15:00:20'),
(7, 1, 6, '2025-11-11 15:00:20'),
(8, 1, 5, '2025-11-11 15:00:20'),
(9, 1, 7, '2025-11-11 15:00:20'),
(10, 1, 8, '2025-11-11 15:00:20'),
(11, 1, 1, '2025-11-11 15:00:20'),
(16, 2, 9, '2025-11-11 15:00:20'),
(17, 2, 10, '2025-11-11 15:00:20'),
(18, 2, 8, '2025-11-11 15:00:20'),
(19, 2, 1, '2025-11-11 15:00:20'),
(23, 3, 8, '2025-11-11 15:00:20'),
(24, 2, 66, '2025-11-21 20:06:13'),
(25, 2, 35, '2025-11-21 20:06:17'),
(26, 2, 37, '2025-11-21 20:06:18'),
(27, 2, 36, '2025-11-21 20:06:19'),
(28, 2, 34, '2025-11-21 20:06:19'),
(29, 2, 70, '2025-11-21 20:06:22'),
(30, 2, 68, '2025-11-21 20:06:23'),
(31, 2, 72, '2025-11-21 20:06:24'),
(32, 2, 67, '2025-11-21 20:06:25'),
(33, 2, 71, '2025-11-21 20:06:25'),
(34, 2, 65, '2025-11-21 20:06:28'),
(35, 2, 64, '2025-11-21 20:06:29'),
(36, 2, 69, '2025-11-21 20:06:31'),
(37, 2, 63, '2025-11-21 20:06:32'),
(38, 2, 33, '2025-11-21 20:06:33'),
(39, 2, 60, '2025-11-21 20:06:35'),
(40, 2, 52, '2025-11-21 20:06:36'),
(41, 2, 56, '2025-11-21 20:06:38'),
(42, 2, 62, '2025-11-21 20:06:38'),
(43, 2, 54, '2025-11-21 20:06:39'),
(44, 2, 58, '2025-11-21 20:06:41'),
(45, 2, 61, '2025-11-21 20:06:42'),
(46, 2, 53, '2025-11-21 20:06:43'),
(47, 2, 57, '2025-11-21 20:06:44'),
(48, 2, 59, '2025-11-21 20:06:45'),
(49, 2, 51, '2025-11-21 20:06:48'),
(50, 2, 55, '2025-11-21 20:06:48'),
(51, 2, 76, '2025-11-21 20:06:54'),
(52, 2, 75, '2025-11-21 20:06:54'),
(55, 2, 2, '2025-11-21 20:07:00'),
(57, 2, 11, '2025-11-21 20:07:03'),
(58, 2, 77, '2025-11-21 20:07:04'),
(59, 2, 73, '2025-11-21 20:07:05'),
(60, 2, 78, '2025-11-21 20:07:05'),
(61, 2, 74, '2025-11-21 20:07:07'),
(62, 2, 3, '2025-11-21 20:07:29'),
(63, 2, 6, '2025-11-21 20:07:31'),
(64, 2, 5, '2025-11-21 20:07:55'),
(65, 2, 48, '2025-11-21 20:08:03'),
(66, 2, 42, '2025-11-21 20:08:03'),
(67, 2, 45, '2025-11-21 20:08:05'),
(68, 2, 39, '2025-11-21 20:08:06'),
(69, 2, 47, '2025-11-21 20:08:07'),
(70, 2, 41, '2025-11-21 20:08:08'),
(71, 2, 46, '2025-11-21 20:08:15'),
(72, 2, 40, '2025-11-21 20:08:16'),
(73, 2, 49, '2025-11-21 20:08:17'),
(74, 2, 43, '2025-11-21 20:08:18'),
(75, 2, 50, '2025-11-21 20:08:20'),
(76, 2, 44, '2025-11-21 20:08:21'),
(77, 2, 38, '2025-11-21 20:08:22'),
(78, 1, 34, '2025-11-21 20:59:57');

-- --------------------------------------------------------

--
-- Table structure for table `sys_settings`
--

CREATE TABLE `sys_settings` (
  `id` int NOT NULL,
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('string','integer','float','boolean','json') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_settings`
--

INSERT INTO `sys_settings` (`id`, `key`, `value`, `type`, `description`, `is_public`, `created_at`, `updated_at`) VALUES
(1, 'site_name', 'API Application', 'string', 'Name of the application', 1, '2025-11-11 15:00:20', NULL),
(2, 'site_description', 'A powerful REST API', 'string', 'Description of the application', 1, '2025-11-11 15:00:20', NULL),
(3, 'maintenance_mode', '0', 'boolean', 'Enable maintenance mode', 0, '2025-11-11 15:00:20', NULL),
(4, 'max_login_attempts', '5', 'integer', 'Maximum login attempts before lockout', 0, '2025-11-11 15:00:20', NULL),
(5, 'session_timeout', '3600', 'integer', 'Session timeout in seconds', 0, '2025-11-11 15:00:20', NULL),
(6, 'items_per_page', '20', 'integer', 'Default items per page for pagination', 1, '2025-11-11 15:00:20', NULL),
(7, 'updates_url', 'https://updates.softaware.co.za', 'string', NULL, 0, '2025-11-11 16:15:30', NULL),
(8, 'software_key', '20251111SA', 'string', NULL, 0, '2025-11-11 16:15:41', NULL),
(9, 'app_version', '1.0.1', 'string', NULL, 0, '2025-11-11 16:16:22', '2025-11-11 16:55:39');

-- --------------------------------------------------------

--
-- Table structure for table `sys_users`
--

CREATE TABLE `sys_users` (
  `id` int NOT NULL,
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_users`
--

INSERT INTO `sys_users` (`id`, `username`, `email`, `password`, `first_name`, `last_name`, `is_active`, `is_admin`, `created_at`, `updated_at`) VALUES
(1, 'admin', 'admin@example.com', '$2y$10$ZfMC8W1IglSRj3qc4uAzp.vXD6265/CcWN/4IsuKdCLjknQDMjsvC', 'Admin', 'User', 1, 1, '2025-11-11 15:00:20', '2025-11-21 16:44:04'),
(2, 'Naledi', 'sales@softaware.co.za', '$2y$10$sUzHwSDJeKp4qF4ZLkdx3.5HzqBf3IatsPwpmnOt8f23F0WovIBoO', 'Naledi', 'Nomsobo', 1, 1, '2025-11-21 20:05:59', '2025-11-22 14:51:14');

-- --------------------------------------------------------

--
-- Stand-in structure for view `sys_users_with_roles`
-- (See below for the actual view)
--
CREATE TABLE `sys_users_with_roles` (
`created_at` datetime
,`email` varchar(100)
,`first_name` varchar(50)
,`id` int
,`is_active` tinyint(1)
,`is_admin` tinyint(1)
,`last_name` varchar(50)
,`role_ids` text
,`roles` text
,`updated_at` datetime
,`username` varchar(50)
);

-- --------------------------------------------------------

--
-- Table structure for table `sys_user_roles`
--

CREATE TABLE `sys_user_roles` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sys_user_roles`
--

INSERT INTO `sys_user_roles` (`id`, `user_id`, `role_id`, `created_at`) VALUES
(1, 1, 1, '2025-11-11 15:00:20'),
(2, 2, 2, '2025-11-21 20:05:59');

-- --------------------------------------------------------

--
-- Table structure for table `tb_accounts`
--

CREATE TABLE `tb_accounts` (
  `account_id` int NOT NULL,
  `code` varchar(20) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(20) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Dumping data for table `tb_accounts`
--

INSERT INTO `tb_accounts` (`account_id`, `code`, `name`, `type`, `is_active`) VALUES
(1, '1000', 'Bank', 'asset', 1),
(7, '1100', 'Accounts Receivable', 'asset', 1),
(8, '2000', 'VAT Output', 'liability', 1),
(9, '4000', 'Sales Revenue', 'income', 1);

-- --------------------------------------------------------

--
-- Table structure for table `tb_categories`
--

CREATE TABLE `tb_categories` (
  `category_id` int NOT NULL,
  `category_name` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

--
-- Dumping data for table `tb_categories`
--

INSERT INTO `tb_categories` (`category_id`, `category_name`) VALUES
(7, 'Face Protection/ Respiratory'),
(8, 'Ear Protection'),
(9, 'Hand Protection'),
(10, 'Work Wear and high Visibility'),
(11, 'Heights and Site'),
(12, 'Footwear');

-- --------------------------------------------------------

--
-- Table structure for table `tb_contacts`
--

CREATE TABLE `tb_contacts` (
  `contact_id` int NOT NULL,
  `contact_name` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `contact_type` int NOT NULL,
  `contact_person` varchar(50) DEFAULT NULL,
  `contact_address` text,
  `contact_email` varchar(50) DEFAULT NULL,
  `contact_phone` varchar(50) DEFAULT NULL,
  `contact_alt_phone` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `contact_notes` text,
  `contact_vat` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Dumping data for table `tb_contacts`
--

INSERT INTO `tb_contacts` (`contact_id`, `contact_name`, `contact_type`, `contact_person`, `contact_address`, `contact_email`, `contact_phone`, `contact_alt_phone`, `contact_notes`, `contact_vat`) VALUES
(2, 'Rely Precisions', 1, 'Muzi', 'Commissioner Street Boksburg', 'muzis@rely.co.za', '+27 11 914 1640 ', '', '', '4780275113'),
(3, 'Hennox Suppplies', 2, 'Rasheed', '1 Quality Road \nIsando', 'bordersales2@hennoxsupplies.co.za', '011 397 6319', '078 433 0931', '', '4770252742'),
(4, 'Pinnacle Weld', 2, 'Loveness', '451 Bergvlei Rd, Wadeville', 'sales10@pinnacleweld.co.za', '011  824 0001', '065 903 1928', '', ''),
(5, 'Cattell\'s', 2, 'Mary-Anne', 'Nuffield Springs', 'sales@cattells.co.za', '011 363 3363', '', '', ''),
(6, 'Procon', 2, 'Rene', '60 All Black Road \nAnderbolt Boksburg', 'sales8@gloves.co.za', '011 917 9402', '', '', '4900157092'),
(7, 'Stitch Direct', 2, 'Carel', 'Anderbolt Boksburg', 'info@stichdirect.co.za', '011 892 4657', '', '', '4160264414'),
(8, 'Bora Mining Services', 1, 'Zoe', 'Whitby Manor Office Estate,  162 14th Road Noordwyk Midrand', 'zodwa@boramining.co.za', '010 130 1730', '082 638 1538', '', ''),
(9, 'Aquajet', 1, 'Sinah', '15B Barium Road. Alrode Alberton', 'info@aquajet.co.za', '011 908 5550', '', '', ''),
(10, 'Trencon', 1, 'Zenobia', '42 Main Road Eastleigh Edenvale', 'zenobia@trencon.co.za', '011 451 8000', '0829209375', '', '4270 159 470'),
(11, 'AM Hengtong', 1, 'Poko', 'Kempton Park', 'sndobeni@amhengtong.co.za', '+27 10 030 0195', '', '', ''),
(12, 'Forbentinto Construction', 1, 'Bernadette', 'Kempton Park', 'info@forbestinto.co.za', '087 265 9533', '073 133 8539', '', ''),
(13, 'Buyhub', 1, 'Brian', '2877 Albertina Sisulu Rd, Technikon, Roodepoort, 1734', 'brianv@chemplus.co.za', '+27 76-313-6411', '', '', ''),
(14, 'WK Construction', 1, 'Abel', 'Olifantsfontein', 'abel.netshivhodza@wkc.co.za', '011 206 2000', '082 885 7959', '', ''),
(15, 'COD- Ingala Insulation', 1, '', '', 'ingalainsulation@gmail.com', '083 719 550', '068 025 7883', '', ''),
(16, 'Tree and Wood', 1, 'Nico', '', 'info@treeandwood.co.za', '+27680109638', '', '', ''),
(17, 'The Wood Turner', 1, 'Adri', '', 'info@thewoodturner.co.za', '012 – 111 0484', '', '', ''),
(18, 'BMF Technologies Limited', 1, 'Taby', '15 Liberia Street Nkana East Kitwe Zambia', 'taby@bmfzambia.com', '+260996359931', '+260779827037', '<p>Acc No: C-BMF001</p>', ''),
(19, 'Reunko Steel', 1, 'Jerry', '35 Radio Street, Alberton North, Alberton', 'jerry@reunko.co.za', '011 869 2984', '', '', ''),
(20, 'TMT Engineering', 1, 'Thabiso', '5 Laurie Ruben St, Anderbolt, Boksburg, 1459', 'thabiso@tmt.net.za', '011 824 0001', '', '', ''),
(21, 'Broadway Sweets', 1, 'Yusuf', '92 Main Reef road Wychwood Ext 1, Germiston', 'yusuf.ie@broadwaysweets.co.za', '+27 11 615 7120', '073 272 7950', '', ''),
(22, 'Fabcon Steel', 1, 'Rachel', '19 Old Vereeniging Road, Klipriver Midvaal', 'accounts@fabconsteel.co.za', '010 072 2221', '', '', ''),
(23, 'Allbro ', 1, 'Leonie Eiberg', 'Boksburg', 'Buying@allbro.com', '011 894 8341', '', '', ''),
(24, 'Thero Services', 1, 'Themba', '86 17th Avenue Edenvale', 'admin@theroserv.com', '010 021 0132', '', '', ''),
(25, 'Alloy magnetic Components', 1, 'Trisha', 'Cnr Simon Bekker and Crompton Road Germiston South', 'trisha@amccores.com', '011 825 1010', '', '', ''),
(26, 'G4 Mining and Civils', 1, 'Otto', ' 3 Kirschner Rd, Benoni North AH, Benoni, 1509', 'otto@g4miningandcivils.co.za', '011 100 7126', '', '', ''),
(27, 'Quality Tube Services', 1, 'Lindy', '462 Ketton Road Wadeville Germiston', 'lhattingh@qualitytube.co.za', '011 865 5554', '', '', ''),
(28, 'In2 Food', 1, 'Mpume', ' 34 Van Dyk Road Benoni', 'mpume.mabaso@in2food.co.za', '010  001 7535', '074 640 3207', '', ''),
(29, 'Sebedisano Logistics (Pty) Ltd', 1, 'Malose', 'Fancourt Office Park, Building 5, Tokamo Pharma. 9 Felstead Raod Randburg', 'malose@mcl-inc.co.za', '072 981 0717', '', '', ''),
(30, 'Zee Lodge', 1, 'Thabiso', '916 Loskop Noord Mpumalanga', 'admin@zeelodge.co.za', '083 715 0423', '', '', ''),
(31, 'Dunlop Belting Products (Pty) Ltd', 1, 'Sheila', '22-24 Lincolin Road Nestadt Industrial Park Benoni', 'SheilaS@dbp.co.za', '+27 (0)11 741 2500', '+27 79 513 6397', '', '4720206053'),
(32, 'Zimco Metals', 1, 'Marisa', 'Benoni', 'MarisaC@zimcometals.co.za', '011 914 4300', '', '', ''),
(33, 'Alligator', 1, 'Bianca', 'Midrand', 'bianca.satige@alligator.co.za', '011 312 4890', '011 312 4865', '', ''),
(34, 'Bennets', 1, 'Nikitta', 'Linbro Park', 'nikitta@colic.co.za', '011 608 9733', '', '', ''),
(35, 'Betachem (Pty) Ltd', 1, 'Dolly/Sibusiso', 'Heidelburg', 'dolly@bchem.co.za', '011 782 8789', '068 079 1588', '', ''),
(36, 'Brelko Conveyor products', 1, 'Klaas', 'Booysens, JHB', 'klaas@brelko.com', '011 003 4000', '', '', ''),
(37, 'Cartoon Candy (Pty) Ltd', 1, 'Devi', 'N Reef Rd, Rietfontein 63-Ir, Germiston, 1429', 'devi@cartooncandy.co.za', '011 345 6000', '', '', '4340181405'),
(39, 'Certus Engineering', 1, 'Tean', '6 Axle drive, Clayville X11, Olifantsfontein,', 'admin2@certus.co.za', '011 316 6549', '086 123 7887', '', ''),
(41, 'Mican', 2, 'Dess', '119 Paul Smit Street, Anderbolt, Boksburg', 'dess@mican.co.za', '011 918-3502', '', '', '4480206798'),
(42, 'Compact cool', 1, 'Clive', '', 'buyer@compactcool.com', ' 011 835 1131', '', '', ''),
(43, 'CT Hydraulics (Nqoba) (Pty) Ltd', 1, 'Dominique', 'Cnr Melville and Sharland Street, Driehoek', 'dominique@cthydraulics.co.za', '', '', '', ''),
(44, 'Ductech', 1, 'Hanry', 'Driehoek, Germiston', 'stores@ductech.co.za', '011 873 8920', '', '', ''),
(45, 'Extrupet', 1, ' Mr Frans', '100 Dekema Road, Wadeville, Germiston', 'bilash@extrupet.com', '011 865 8360', '', '', '4940214390'),
(46, 'Collect- A- Can', 1, 'Leanne', '2 O’Connor Road, Aeroton, Johannesburg', 'LeanneF@collectacan.co.za', '011 494 3623', '', '', ''),
(47, '4J Metals', 1, 'Lizelle', '173 3rd Ave, Bredell, Kempton Park, Gauteng', 'lizelle@4jmetals.co.za', '063 573 2985', '062 554 8306', '', ''),
(48, 'COD- KPL Die Casting', 1, 'Victoria', 'Germiston', 'victoria@kpl.co.za', '011 873 0264', '', '', ''),
(49, 'COD - Phoenix Group SA', 1, 'Thenji', 'Benoni', 'Info@phoenixgroupsa.co.za', ' (011) 425-0354', '', '', ''),
(50, 'COD- Machine Moving & Engineering', 1, 'Rohan', 'Wadeville', '', '+27 11 824 5172', '0829531854', '', ''),
(51, 'Test Contact 1762513822', 1, NULL, NULL, 'testcontact@example.com', '123-456-7890', NULL, NULL, NULL),
(52, 'Test Contact 1762513982', 1, NULL, NULL, 'testcontact@example.com', '123-456-7890', NULL, NULL, NULL),
(53, 'Desiloper', 1, 'T', '', 'goodwillgts@gmail.com', '', '', '', ''),
(55, 'Catercare', 2, '', '522 Commissioner street\nBoksburg', '', '0119142772', '0119172772', '', '4570110025'),
(56, 'Africa Cleaning Products', 2, 'Kristi', '', 'Kristi@acssa.co.za', '0119023340', '', '', '4300278670'),
(57, 'Benoni Bolt and Tool', 2, 'Farook', '17 Swan Street\nBenoni', '', '0114218915', '', '', '4750145676'),
(58, 'Citronol Hand Cleaner', 2, 'Edwina', 'Unit 2, 137  Mastiff Road\nMidrand Industrial Park', 'info@citronol.co.za', '0113107557/7155', '', '', '4410170726'),
(59, 'Crazy Plastics', 2, '', 'Boksburg', '', '0100210419', '', '', '4330261712'),
(60, 'Lukas ', 2, 'Mark', '1288 Harriet Avenue\nDriehok\nGermiston', '', '0118251550/4', '', '', '4050261892'),
(61, 'Novus Sealing SA', 2, 'Cleo', '15 Coert Stynberg Street\nVan Eck Park\nDalpark, Brakpan', 'Cleo@novussealing.co.za', '0119150016', '', '', '4120224755'),
(62, 'Handy Grments', 2, '', '2 Drakensburg Drive\nUnit 4 Longmeadow', '', '0114548888', '', '', ''),
(63, 'Barron Clothing', 2, '', 'Cnr Peace and School street\nWestlake\nEdenvale', '', '011 457 8700', '', '', '4930261294'),
(64, 'Ital Workwear', 2, '', 'Unit 3 Union Centre\nNorth Reef Road\nBedfirdview', '', '0116094434', '', '', '4330241987'),
(65, 'Battery Mark cc', 2, '', '295 Commisioner\nBoksburg', 'batmark@telkomsa.net', '0118923497', '', '', '4860188798'),
(66, 'Company Expenses', 2, '', '', '', '', '', '', ''),
(67, 'Test Supplier', 1, 'Gugu', 'Boksburg', 'naledi@softaware.co.za', '01125965874', '026589563', '', '');

-- --------------------------------------------------------

--
-- Table structure for table `tb_expense_categories`
--

CREATE TABLE `tb_expense_categories` (
  `category_id` int NOT NULL,
  `category_name` varchar(100) NOT NULL,
  `category_code` varchar(20) DEFAULT NULL,
  `category_group` varchar(50) DEFAULT NULL,
  `itr14_mapping` varchar(100) DEFAULT NULL,
  `allows_vat_claim` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tb_expense_categories`
--

INSERT INTO `tb_expense_categories` (`category_id`, `category_name`, `category_code`, `category_group`, `itr14_mapping`, `allows_vat_claim`, `created_at`) VALUES
(1, 'Rent', 'RENT', 'Operating Expenses', 'Rent paid', 1, '2025-11-04 21:05:06'),
(2, 'Telephone & Internet', 'TELCO', 'Operating Expenses', 'Telephone & Internet', 1, '2025-11-04 21:05:06'),
(3, 'Printing & Stationery', 'PRINT', 'Operating Expenses', 'Printing & Stationery', 1, '2025-11-04 21:05:06'),
(4, 'Bank Charges', 'BANK', 'Administrative', 'Bank charges', 1, '2025-11-04 21:05:06'),
(5, 'Cost of Sales', 'COGS', 'Direct Costs', 'Cost of sales', 1, '2025-11-04 21:05:06'),
(6, 'Repairs & Maintenance', 'REPAIR', 'Operating Expenses', 'Repairs & Maintenance', 1, '2025-11-04 21:05:06'),
(7, 'Vehicle Expenses', 'VEHICLE', 'Transport & Vehicle', 'Motor vehicle expenses', 1, '2025-11-04 21:05:06'),
(8, 'Consulting Fees', 'CONSULT', 'Administrative', 'Professional fees', 1, '2025-11-04 21:05:06'),
(9, 'Entertainment', 'ENTERTAIN', 'People Costs', 'Entertainment', 0, '2025-11-04 21:05:06'),
(10, 'Salaries & Wages', 'SALARIES', 'People Costs', 'Salaries, wages & allowances', 0, '2025-11-04 21:05:06'),
(11, 'Office Supplies', 'OFFICE', 'Operating Expenses', 'Office expenses', 1, '2025-11-04 21:05:06'),
(12, 'Insurance', 'INSURANCE', 'Business Services', 'Insurance', 1, '2025-11-04 21:05:06'),
(13, 'Legal & Accounting', 'LEGAL', 'Administrative', 'Legal & Accounting', 1, '2025-11-04 21:05:06'),
(14, 'Marketing & Advertising', 'MARKETING', 'Business Services', 'Advertising', 1, '2025-11-04 21:05:06'),
(15, 'Utilities', 'UTILITIES', 'Operating Expenses', 'Electricity, water & rates', 1, '2025-11-04 21:05:06'),
(16, 'Travel', 'TRAVEL', 'Transport & Vehicle', 'Travel expenses', 1, '2025-11-04 21:05:06'),
(17, 'Subscriptions & Licenses', 'SUBS', 'Administrative', 'Subscriptions & memberships', 1, '2025-11-04 21:05:06'),
(18, 'Bad Debts', 'BADDEBT', 'Other', 'Bad debts', 1, '2025-11-04 21:05:06'),
(19, 'Other Expenses', 'OTHER', 'Other', 'Other expenses', 1, '2025-11-04 21:05:06');

-- --------------------------------------------------------

--
-- Table structure for table `tb_groups`
--

CREATE TABLE `tb_groups` (
  `group_id` int NOT NULL,
  `group_parent_id` int NOT NULL,
  `group_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `tb_installed_updates`
--

CREATE TABLE `tb_installed_updates` (
  `id` int NOT NULL,
  `update_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `downloaded_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `installed_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tb_invoices`
--

CREATE TABLE `tb_invoices` (
  `invoice_id` int NOT NULL,
  `invoice_contact_id` int NOT NULL DEFAULT '0',
  `invoice_total` double DEFAULT '0',
  `invoice_updated` bigint DEFAULT NULL,
  `invoice_subtotal` double DEFAULT '0',
  `invoice_vat` double DEFAULT '0',
  `invoice_discount` double DEFAULT '0',
  `invoice_date` date DEFAULT NULL,
  `invoice_valid_until` date DEFAULT NULL,
  `invoice_notes` text,
  `invoice_email` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `invoice_status` int NOT NULL DEFAULT '0',
  `invoice_user_id` int NOT NULL DEFAULT '0',
  `invoice_subject` text,
  `invoice_quote_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tb_invoices`
--

INSERT INTO `tb_invoices` (`invoice_id`, `invoice_contact_id`, `invoice_total`, `invoice_updated`, `invoice_subtotal`, `invoice_vat`, `invoice_discount`, `invoice_date`, `invoice_valid_until`, `invoice_notes`, `invoice_email`, `invoice_status`, `invoice_user_id`, `invoice_subject`, `invoice_quote_id`) VALUES
(1004, 2, 4486.53, 1762931532, 4486.53, 0, 0, '2025-02-12', '2025-02-28', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 142),
(1010, 2, 2371.6, 1762931546, 2371.6, 0, 0, '2025-02-27', '2025-02-28', 'Notes', '                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 158),
(1011, 18, 30240, 1742545812, 30240, 0, 0, '2025-02-27', '2025-02-28', 'Notes', '                                                                                    <p>Good day Taby,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 144),
(1014, 2, 1353.93, 1762931602, 1353.93, 0, 0, '2025-03-06', '2025-03-30', 'Notes', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 173),
(1019, 18, 103320.36, 1762846725, 103320.36, 0, 0, '2025-03-17', '2025-04-15', 'Notes\r\n\r\nOrder Number: Taby\r\n\r\nExport Code: CU25636850', '                                                                                                                                                                                                    <p>Good day Taby,\r\n                            </p><p>Please find your invoice attached. Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 'Invoice 1019', 176),
(1020, 2, 2204.47, 1762931638, 2204.47, 0, 0, '2025-03-17', '2025-04-15', 'Notes', '                                                                                                                                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your Proforma Invoice attached. Please Pay on this Proforma and not on your PO (amounts are different due to the credit you have)</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 'Profoma 1020', 174),
(1023, 2, 441.6, 1762846642, 441.6, 0, 0, '2025-03-24', '2025-04-22', 'Notes\r\nOrder Number: 055448', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 173),
(1024, 2, 441.6, 1762846556, 441.6, 0, 0, '2025-03-24', '2025-04-22', 'Notes\r\nOrder Number: 055437', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 173),
(1025, 2, 538.2, 1762846496, 538.2, 0, 0, '2025-03-24', '2025-04-22', 'Notes\r\nOrder Number : 055446', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 158),
(1026, 2, 1885.9, 1762846355, 1885.9, 0, 0, '2025-03-24', '2025-04-22', 'Notes\r\nOrder Number: 055428', '                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 174),
(1027, 2, 2023.92, 1762846944, 2023.92, 0, 0, '2025-03-24', '2025-04-22', 'Notes\r\nOrder Number: 055446', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 178),
(1028, 10, 3650.1, 1754841083, 3174, 476.1, 0, '2025-04-04', '2025-05-03', 'Order Number: 75729', '                                                                                                                                            <p>Good day Zenobia,\r\n                            </p><p>Please find your invoice attached. Kindly send POP when payment when PMT is done so we can process accordingly.</p><p>Thank you so much.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 'Proforma 1028', 188),
(1029, 29, 1545.59, 1744184497, 1545.59, 0, 0, '2025-04-09', '2025-05-08', 'Notes', '                                                                                    <p>Good day Malose,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, 'Proforma 1029', 193),
(1030, 20, 4033.2, 1762847842, 4033.2, 0, 0, '2025-04-09', '2025-05-08', 'Notes', '                                                                                                                                                                                                                                                            <p>Good day Thabiso,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 195),
(1031, 29, 4615.6055, 1762930680, 4013.57, 602.04, 0, '2025-04-09', '2025-05-08', 'Notes', '                                                                                                                <p>Good day Malose,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 125),
(1032, 30, 4033.2, 1762847964, 4033.2, 0, 0, '2025-04-10', '2025-05-09', 'Notes', '                                                        <p>Good day Thabiso,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 195),
(1033, 29, 1932, 1762874613, 1932, 0, 0, '2025-04-14', '2025-05-26', 'Notes', '                                                                                                                                                                                                    <p>Good day Malose,\r\n                            </p><p>Please find your invoice attached Amended Invoce.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 'Profoma  1033', 196),
(1034, 2, 952.61, 1744616027, 952.61, 0, 0, '2025-04-14', '2025-05-13', 'Notes\r\nPO Number: 055571', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 194),
(1035, 2, 316.63, 1744616350, 316.63, 0, 0, '2025-04-14', '2025-05-13', 'Notes\r\nPO Number: 055572', '                            <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                        ', 2, 1, '', 182),
(1036, 2, 158.7, 1762848098, 138, 20.7, 0, '2025-04-22', '2025-05-21', 'Notes\r\nOrder Number:  055581', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached. Kindly Print a copy for us if you can and sign.</p><p>We will deliver the stock today.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 'Invoice 1036', 194),
(1037, 30, 412.17, 1762848319, 412.17, 0, 0, '2025-04-22', '2025-05-21', 'Notes', '                                                                                                                                                                                                    <p>Good day Thabiso,\r\n                            </p><p>Please find your invoice attached. </p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 'INV1037', 199),
(1038, 2, 824.2, 1762932627, 824.2, 0, 0, '2025-05-07', '2025-06-05', 'Notes\r\nPO Number: 055643 & 055634', '                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 202),
(1039, 30, 927.452, 1762848445, 806.48, 120.97, 0, '2025-05-21', '2025-06-19', 'Notes', '                                                        <p>Good day Thabiso,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 206),
(1040, 2, 4429.4895, 1747811400, 3851.73, 577.76, 0, '2025-05-21', '2025-06-19', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 212),
(1041, 2, 2333.5685, 1749710210, 2029.19, 304.38, 0, '2025-06-04', '2025-07-03', 'Notes\r\nOrder Number : 055730', '                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 221),
(1042, 20, 5213.3295, 1749710308, 4533.33, 680, 0, '2025-06-12', '2025-07-11', 'Notes', '                            <p>Good day Thabiso,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                        ', 2, 1, '', 201),
(1043, 2, 1113.9705, 1762848525, 968.67, 145.3, 0, '2025-06-20', '2025-07-19', 'Notes\r\nOrder Number:  055782', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 'Proforma 1043', 232),
(1044, 37, 2568.525, 1750776527, 2233.5, 335.02, 0, '2025-06-23', '2025-07-22', 'Notes\r\nAcc No: CAR101\r\nOrder Number : PO27900', '                                                                                                                                                                                                    <p>Good day Devi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 233),
(1045, 37, 243.225, 1754840965, 211.5, 31.72, 0, '2025-06-27', '2025-07-26', 'Notes\r\nOrder Number:  PO27913\r\nAcc No: CAR001', '                                                                                                                <p>Good day Devi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 239),
(1046, 10, 3446.9294999999997, 1751875310, 2997.33, 449.6, 0, '2025-06-27', '2025-07-26', 'Notes\r\nOrder Number:76306\r\nAcc No: TRE001', '                                                        <p>Good day Zenobia,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 229),
(1047, 18, 107604, 1762848703, 107604, 0, 0, '2025-06-30', '2025-07-29', 'Notes\r\nOrder Number: Taby\r\nCustoms Code: CU25636850\r\n', '                                                                                    <p>Good day Taby,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 240),
(1048, 2, 2771.362, 1762848766, 2409.88, 361.48, 0, '2025-07-15', '2025-08-13', 'Notes\r\nOrder Number: 055876', '                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 248),
(1049, 15, 3407.0705000000003, 1762848833, 2962.67, 444.4, 0, '2025-07-16', '2025-08-14', 'Notes', '                                                                                                                <p>Good day Thenji,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 250),
(1050, 37, 2811.75, 1762849614, 2445, 366.75, 0, '2025-07-25', '2025-07-31', 'Notes\r\nOrder Number: PO28079', '                                                                                                                <p>Good day Devi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 251),
(1051, 20, 3827.2, 1762849666, 3328, 499.2, 0, '2025-07-29', '2025-08-27', 'Notes', '                                                        <p>Good day Thabiso,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 257),
(1052, 45, 25178.1, 1762849810, 21894, 3284.1, 0, '2025-08-01', '2025-08-30', 'Notes\r\nOrder NUmber: WAD012507POH00000524', '                                                                                    <p>Good day France,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 261),
(1053, 2, 2052.106, 1762849865, 1784.44, 267.67, 0, '2025-08-04', '2025-09-02', 'Notes\r\nOrder Number: 055998', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 263),
(1054, 37, 659.3294999999999, 1754919614, 573.33, 86, 0, '2025-08-08', '2025-09-06', 'Notes\r\nOrder Number: Devi Samples', '                                                        <p>Good day Devi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 254),
(1055, 20, 730.48, 1762849913, 635.2, 95.28, 0, '2025-08-08', '2025-09-06', 'Notes\r\nReference: Philadi', '                                                                                    <p>Good day Thabiso,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 264),
(1056, 10, 1449, 1762849976, 1260, 189, 0, '2025-08-27', '2025-09-25', 'Notes\r\nOrder Number: 76820\r\n', '                                                        <p>Good day Zenobia,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 2, 1, '', 270),
(1057, 45, 22578.329500000003, 1762850105, 19633.33, 2945, 0, '2025-09-01', '2025-09-30', 'Notes', '                                                                                                                                            <p>Good day France,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 278),
(1058, 2, 3982.6915, 1762850197, 3463.21, 519.48, 0, '2025-09-16', '2025-10-15', 'Notes.\r\nOrder Number: 056201', '                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 282),
(1059, 2, 2152.11, 1762850321, 1871.4, 280.71, 0, '2025-10-06', '2025-11-04', 'Notes\r\nOrder Number: 056305', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 288),
(1060, 10, 40647.1295, 1762771548, 35345.33, 5301.8, 0, '2025-10-20', '2025-11-18', 'Notes\r\nOrder Number:  77292', '                                                                                    <p>Good day Zenobia,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, '', 274),
(1061, 2, 3013, 1762850377, 2620, 393, 0, '2025-11-05', '2025-12-04', 'Notes\r\nOrder Number : 056471', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your invoice attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, '', 300),
(1062, 47, 781.25, 1768241735, 781.25, 0, 0, '2025-10-28', '2026-02-11', '', NULL, 0, 2, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tb_invoice_items`
--

CREATE TABLE `tb_invoice_items` (
  `item_id` int NOT NULL,
  `item_invoice_id` int NOT NULL,
  `item_product` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `item_price` double NOT NULL DEFAULT '0',
  `item_profit` double NOT NULL DEFAULT '0',
  `item_discount` text,
  `item_subtotal` double NOT NULL DEFAULT '0',
  `item_cost` double NOT NULL DEFAULT '0',
  `item_supplier_id` int DEFAULT '0',
  `item_qty` int NOT NULL DEFAULT '1',
  `item_vat` double NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;

--
-- Dumping data for table `tb_invoice_items`
--

INSERT INTO `tb_invoice_items` (`item_id`, `item_invoice_id`, `item_product`, `item_price`, `item_profit`, `item_discount`, `item_subtotal`, `item_cost`, `item_supplier_id`, `item_qty`, `item_vat`) VALUES
(72, 1016, 'Knee Welding Spats', 108.40666666667, 88.375, '0.00', 542.03, 70.7, 0, 5, 10.605),
(73, 1016, 'Varta Industrial AA 10 Pack ', 107.33333333333, 17.5, '0.00', 107.33, 70, 0, 1, 10.5),
(71, 1016, 'Blue Lined Welding Gloves Elbow', 83.72, 163.8, '0.00', 1004.64, 54.6, 0, 12, 8.19),
(70, 1016, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 179.4, 117, '0.00', 717.6, 117, 0, 4, 17.55),
(1183, 1004, 'P2 Cartridges (Dust Cartridge)', 55.506666666667, 181, '0.00', 1110.13, 36.2, 0, 20, 5.43),
(1184, 1004, '3M 6300 Half Face Mask			', 358.64666666667, 233.9, '0.00', 1434.59, 233.9, 0, 4, 35.085),
(1189, 1010, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 179.4, 117, '0.00', 717.6, 117, 0, 4, 17.55),
(1187, 1010, 'Knee Welding Spats', 108.40666666667, 88.375, '0.00', 542.03, 70.7, 0, 5, 10.605),
(1188, 1010, 'Blue Lined Welding Gloves Elbow', 83.72, 163.8, '0.00', 1004.64, 54.6, 0, 12, 8.19),
(1192, 1014, 'FFP2 Dust Mask SABS Approved', 3.68, 60, '0.00', 368, 2.4, 0, 100, 0.36),
(1191, 1014, 'Rags Super absorbent /kg', 21.773333333333, 88.75, '0.00', 544.33, 14.2, 0, 25, 2.13),
(1190, 1014, 'Virgin toilet paper 1ply 48\'s', 220.8, 72, '0.00', 441.6, 144, 0, 2, 21.6),
(975, 1019, 'PVC Red Glove Open Cuff 40cm', 21, 16845.711, '0.00', 103320.36, 13.6957, 0, 4920, 2.054355),
(207, 1011, 'PVC Red Glove Open Cuff 40cm', 21, 4930.434, '0.0', 30240, 13.69565, 0, 1440, 2.0543475),
(1011, 1030, 'ROXIE LADYS SAFETY SHOE SIZE 6 (Dorah)', 444.67, 72.5, '0.00', 444.67, 290, 0, 1, 43.5),
(1012, 1030, 'ROXIE LADYS SAFETY SHOE SIZE 5 (Mavis)', 444.67, 72.5, '0.00', 444.67, 290, 0, 1, 43.5),
(970, 1023, 'Virgin toilet paper 1ply 48\'s', 220.8, 72, '0.00', 441.6, 144, 0, 2, 21.6),
(969, 1024, 'FFP2 Dust Mask SABS Approved', 3.68, 72, '0.00', 441.6, 2.4, 0, 120, 0.36),
(298, 1029, 'Navy Blue Freezer Jacket M', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(296, 1029, 'Navy Blue Freezer Jacket XL', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(297, 1029, 'Navy Blue Freezer Jacket L', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(968, 1025, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 179.4, 87.75, '0.00', 538.2, 117, 0, 3, 17.55),
(294, 1029, 'Sebedisano Logo Embroidery Front Left Chest', 26.07, 17, '0.00', 104.27, 17, 0, 4, 2.55),
(980, 1027, 'Dromex Chrome leather double palm elbow length 8', 46.89, 183.483, '0.00', 1125.36, 30.5805, 0, 24, 4.587075),
(1196, 1020, 'Dromex Yellow household Glove with Flock Liner', 9.15, 35.82, '0.00', 219.7, 5.97, 0, 24, 0.8955),
(1195, 1020, 'Citronol Hand Cleaner with grit 30kg', 810.01, 132.0675, '0.00', 810.01, 528.27, 0, 1, 79.2405),
(1193, 1020, 'P2 Cartridges (Dust Cartridge)', 55.51, 181, '0.00', 1110.13, 36.2, 0, 20, 5.43),
(1194, 1020, 'Dromex Clear mono goggle direct vent', 12.93, 10.5375, '0.00', 64.63, 8.43, 0, 5, 1.2645),
(166, 1021, 'DROMEX AGRIMac JACKET, XLARGE (Storm)', 442.17, 144.185, '0.00', 884.33, 288.37, 0, 2, 43.2555),
(167, 1021, 'Wire Nails 75mm / kg', 46, 22.5, '0.00', 138, 30, 0, 3, 4.5),
(165, 1021, 'DROMEX AGRIMac BIB PANTS, XLARGE (Storm)', 431.79, 140.8, '0.00', 863.57, 281.6, 0, 2, 42.24),
(807, 1028, 'Fingersaver 350mm', 1380, 450, '0.00', 2760, 900, 0, 2, 135),
(806, 1028, 'FFP2 Dust Mask SABS Approved 20 / Box. Price for each', 4.14, 67.5, '0.00', 414, 2.7, 0, 100, 0.405),
(979, 1027, 'Dromex Chrome leather double palm  wrist length 2.5', 37.44, 146.505, '0.00', 898.56, 24.4175, 0, 24, 3.662625),
(295, 1029, 'Navy Blue Freezer Jacket  2XL', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(964, 1026, 'DROMEX AGRIMac JACKET, XLARGE (Storm)', 442.17, 144.185, '0.00', 884.33, 288.37, 0, 2, 43.2555),
(965, 1026, 'Wire Nails 75mm / kg', 46, 22.5, '0.00', 138, 30, 0, 3, 4.5),
(963, 1026, 'DROMEX AGRIMac BIB PANTS, XLARGE (Storm)', 431.79, 140.8, '0.00', 863.57, 281.6, 0, 2, 42.24),
(1013, 1030, 'Lady\'s Canteen Coat short sleeve size S-4XL (Available in royal blue or Green)', 107.33, 35, '0.00', 214.67, 70, 0, 2, 10.5),
(1010, 1030, 'DROMEX BOXER BLACK SAFETY BOOT Size 7', 329.85, 53.78, '0.00', 329.85, 215.12, 0, 1, 32.268),
(1008, 1030, 'DROMEX Navy CONTI SUIT with Reflective, sizes 30 Pants- 34 Jacket (Set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(1009, 1030, 'DROMEX BOXER BLACK SAFETY BOOT Size 10', 329.85, 107.56, '0.00', 659.7, 215.12, 0, 2, 32.268),
(1007, 1030, 'DROMEX Navy CONTI SUIT with Reflective, sizes 32Pants- 36 Jacket (Set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(1005, 1030, 'DROMEX 2 TONE PUFFER JACCKET Olive/Black ', 668.61, 109.0125, '0.00', 668.61, 436.05, 0, 1, 65.4075),
(1006, 1030, 'DROMEX Navy CONTI SUIT with Reflective, sizes 36 Pants- 40 Jacket( set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(1179, 1031, 'Sebedisano Logo Front Pocket size', 26.07, 21.25, '0.00', 130.33, 17, 0, 5, 2.55),
(1178, 1031, 'Logo Digitizing', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(1177, 1031, 'D59 Flame Retardant & Acid Resist Trouser Size 36', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(1176, 1031, 'Rebel Kontrakta Boot size 9 ', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(1175, 1031, 'Rebel Kontrakta Boot size 7', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(1174, 1031, 'Navy Crew neck T-shirt 160g size L', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(1171, 1031, 'Navy Crew neck T-shirt 160g size XL ', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(1172, 1031, 'Navy Crew neck T-shirt 160g size XXL ', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(1173, 1031, 'Navy Crew neck T-shirt 160g size M', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(1168, 1031, 'Rebel Kontrakta Boot size 8', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(1169, 1031, 'Rebel Kontrakta Boot size 11', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(1170, 1031, 'Royal Blue Boiler Suit Polycotton with reflective size 44', 199.33, 32.5, '0.00', 199.33, 130, 0, 1, 19.5),
(1003, 1030, 'Logo Embroidery Front Left Chest', 27.6, 27, '0.00', 165.6, 18, 0, 6, 2.7),
(1004, 1030, 'Zee Lodge Logo Digitizing (Once off)', 383.33, 62.5, '0.00', 383.33, 250, 0, 1, 37.5),
(1022, 1032, 'DROMEX 2 TONE PUFFER JACCKET Olive/Black ', 668.61, 109.0125, '0.00', 668.61, 436.05, 0, 1, 65.4075),
(1021, 1032, 'DROMEX Navy CONTI SUIT with Reflective, sizes 36 Pants- 40 Jacket( set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(1020, 1032, 'DROMEX Navy CONTI SUIT with Reflective, sizes 32Pants- 36 Jacket (Set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(1019, 1032, 'DROMEX Navy CONTI SUIT with Reflective, sizes 30 Pants- 34 Jacket (Set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(1018, 1032, 'DROMEX BOXER BLACK SAFETY BOOT Size 10', 329.85, 107.56, '0.00', 659.7, 215.12, 0, 2, 32.268),
(1017, 1032, 'DROMEX BOXER BLACK SAFETY BOOT Size 7', 329.85, 53.78, '0.00', 329.85, 215.12, 0, 1, 32.268),
(1016, 1032, 'ROXIE LADYS SAFETY SHOE SIZE 6 (Dorah)', 444.67, 72.5, '0.00', 444.67, 290, 0, 1, 43.5),
(1015, 1032, 'ROXIE LADYS SAFETY SHOE SIZE 5 (Mavis)', 444.67, 72.5, '0.00', 444.67, 290, 0, 1, 43.5),
(1014, 1032, 'Lady\'s Canteen Coat short sleeve size S-4XL (Available in royal blue or Green)', 107.33, 35, '0.00', 214.67, 70, 0, 2, 10.5),
(645, 1046, 'Names Embroided', 18.67, 28, '0.00', 149.33, 14, 0, 8, 0),
(642, 1046, 'Navy / yellow Vented Reflective Mining Shirt ', 285.33, 428, '0.00', 2282.67, 214, 0, 8, 0),
(644, 1046, 'Your Safety , our priority Embroided', 24, 36, '0.00', 192, 18, 0, 8, 0),
(643, 1046, 'Trencon Logo at the Back Embroided', 46.67, 70, '0.00', 373.33, 35, 0, 8, 0),
(1137, 1033, 'Sebedisano Logo Embroided Front Left Chest', 26.07, 21.25, '0.00', 130.33, 17, 0, 5, 2.55),
(1136, 1033, 'Navy Blue Freezer Jacket M', 360.33, 117.5, '0.00', 720.67, 235, 0, 2, 35.25),
(1134, 1033, 'Navy Blue Freezer Jacket XL', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(1135, 1033, 'Navy Blue Freezer Jacket L', 360.33, 117.5, '0.00', 720.67, 235, 0, 2, 35.25),
(1058, 1039, 'Lady\'s Canteen Coat short sleeve size 2XL Green', 107.33, 35, '0.00', 214.67, 70, 0, 2, 10.5),
(455, 1034, 'Wire Nails 75mm / kg', 47.53, 23.25, '0.00', 142.6, 31, 0, 3, 4.65),
(454, 1034, 'Citronol Hand Cleaner with grit 30 Kg', 810.01, 132.0675, '0.00', 810.01, 528.27, 0, 1, 79.2405),
(1060, 1039, 'Embroidery Zee Lodge', 27.6, 18, '0.00', 110.4, 18, 0, 4, 2.7),
(1059, 1039, 'Dromex  Navy Conti suit with Reflective Tape size 44', 240.7, 78.49, '0.00', 481.41, 156.98, 0, 2, 23.547),
(1049, 1037, 'FFP2 Dust Mask SABS Approved', 4.45, 14.5, '0.00', 88.93, 2.9, 0, 20, 0.435),
(1050, 1037, 'FFP1 Dust Mask SABS Approved', 4.37, 14.25, '0.00', 87.4, 2.85, 0, 20, 0.4275),
(1051, 1037, 'Dromex Spectacle EURO Clear adjustable Frame', 13.91, 13.605, '0.00', 83.44, 9.07, 0, 6, 1.3605),
(1047, 1037, 'Dromex PU Coated Glove Black ', 11.6, 11.3475, '0.00', 69.6, 7.565, 0, 6, 1.13475),
(1031, 1036, 'Ear Muff', 27.6, 22.5, '0.00', 138, 18, 0, 5, 2.7),
(1048, 1037, 'Ear Muff', 27.6, 13.5, '0.00', 82.8, 18, 0, 3, 2.7),
(472, 1035, 'Green PVC Apron Heavy Duty 400gm', 39.87, 32.5, '0.00', 199.33, 26, 0, 5, 3.9),
(471, 1035, 'Black Disinfectant 5lt', 117.3, 19.125, '0.00', 117.3, 76.5, 0, 1, 11.475),
(1200, 1038, 'Dromex Yellow household Glove with Flock Liner', 9.41, 18.42, '0.00', 112.98, 6.14, 0, 12, 0.921),
(1202, 1038, 'Dromex Spectacle EURO Green adjustable Frame', 13.91, 27.21, '0.00', 166.89, 9.07, 0, 12, 1.3605),
(1201, 1038, 'Rags Super Absorbent per kg', 21.77, 88.75, '0.00', 544.33, 14.2, 0, 25, 2.13),
(1063, 1043, 'Dromex Kidney Belt size M', 80, 15, '0.00', 80, 60, 0, 1, 0),
(805, 1045, 'Dromex Cotton Glove ', 4.23, 39.65625, '0.00', 211.5, 3.1725, 0, 50, 0),
(594, 1042, 'Dromex Bunny Jacket Navy S ', 666.67, 375, '0.00', 2000, 500, 0, 3, 0),
(593, 1042, 'Dromex Bunny Jacket Navy L', 666.67, 375, '0.00', 2000, 500, 0, 3, 0),
(592, 1042, 'TMT Logo Digitizing (Once off)', 373.33, 70, '0.00', 373.33, 280, 0, 1, 0),
(540, 1040, 'P2 Cartridges (Dust Cartridge)', 50.6, 165, '0.00', 1012, 33, 0, 20, 4.95),
(541, 1040, '3M ABEK1 Cartridge 6059 ', 228.47, 298, '0.00', 1827.73, 149, 0, 8, 22.35),
(539, 1040, 'Citronol Hand Cleaner with grit 30 Kg', 736, 120, '0.00', 736, 480, 0, 1, 72),
(538, 1040, 'Wire Nails 75mm / kg', 46, 45, '0.00', 276, 30, 0, 6, 4.5),
(591, 1042, 'Embroidery Left Chest', 26.67, 30, '0.00', 160, 20, 0, 6, 0),
(586, 1041, 'FFP2 Dust Mask SABS Approved', 3.68, 60, '0.00', 368, 2.4, 0, 100, 0.36),
(583, 1041, 'Red heat resistant apron palm welding glove,', 73.45, 143.7, '0.00', 881.36, 47.9, 0, 12, 7.185),
(585, 1041, 'Dromex Spectacle EURO Clear adjustable Frame', 12.07, 23.61, '0.00', 144.81, 7.87, 0, 12, 1.1805),
(584, 1041, 'Rags - Super Absorbent (P/KG)', 21.01, 85.625, '0.00', 525.17, 13.7, 0, 25, 2.055),
(582, 1041, 'Dromex Yellow household Glove with Flock Liner', 9.15, 17.91, '0.00', 109.85, 5.97, 0, 12, 0.8955),
(1061, 1043, 'Wayne Duralight Black Gumboot NSTC Size 8', 152.67, 28.625, '0.00', 152.67, 114.5, 0, 1, 0),
(1062, 1043, 'Citronol Hand Cleaner with grit 30 Kg', 736, 138, '0.00', 736, 552, 0, 1, 0),
(620, 1044, 'DROMEX Category III chemical glove ', 44.67, 418.78125, '0.00', 2233.5, 33.5025, 0, 50, 0),
(1064, 1047, 'PVC Red Glove Open Cuff 40cm', 21, 20175.75, '0.00', 107604, 15.75, 0, 5124, 0),
(1068, 1048, 'Dromex Chrome leather double palm elbow length 8', 40, 180.018, '0.00', 960.1, 30.003, 0, 24, 0),
(1066, 1048, 'Dromex Yellow household Glove with Flock Liner', 7.4, 27.765, '0.00', 148.08, 5.553, 0, 20, 0),
(1067, 1048, 'Dromex Chrome leather double palm  wrist length 2.5', 32, 144.018, '0.00', 768.1, 24.003, 0, 24, 0),
(1065, 1048, 'Dromex Ear Plug Tri Flange, Reusable -Corded', 2.67, 100.05, '0.00', 533.6, 2.001, 0, 200, 0),
(1072, 1049, 'Conti suits White size 44', 134.67, 176.75, '0.00', 942.67, 101, 0, 7, 0),
(1071, 1049, 'Conti suits White size 40', 134.67, 227.25, '0.00', 1212, 101, 0, 9, 0),
(1070, 1049, 'Conti suits White size 38', 134.67, 50.5, '0.00', 269.33, 101, 0, 2, 0),
(1069, 1049, 'Conti suits White size 34', 134.67, 101, '0.00', 538.67, 101, 0, 4, 0),
(1075, 1050, 'Dromex Cotton Glove ', 4.23, 39.65625, '0.00', 211.5, 3.1725, 0, 50, 0),
(1076, 1050, 'DROMEX Category III Viper chemical glove ', 44.67, 418.78125, '0.00', 2233.5, 33.5025, 0, 50, 0),
(1081, 1051, 'Dromex D59 Flame and Acid Jacket Size 36', 296, 222, '0.00', 1184, 222, 0, 4, 0),
(1080, 1051, 'Dromex D59 Flame and Acid Pants Size 34', 296, 111, '0.00', 592, 222, 0, 2, 0),
(1079, 1051, 'Dromex D59 Flame and Acid Pants  Size 30', 296, 111, '0.00', 592, 222, 0, 2, 0),
(1078, 1051, 'DROMEX BOXER CHELSEA BOOT BLACK, SIZE 10', 480, 90, '0.00', 480, 360, 0, 1, 0),
(1077, 1051, 'DROMEX BOXER CHELSEA BOOT BLACK, SIZE 3', 480, 90, '0.00', 480, 360, 0, 1, 0),
(1099, 1052, 'Dromex PVC Red Glove Knit Wrist', 11, 618.75, '0.00', 3300, 8.25, 0, 300, 0),
(1098, 1052, 'PVC Red Glove Open Cuff 40cm (Special)', 19, 534.375, '0.00', 2850, 14.25, 0, 150, 0),
(1097, 1052, 'Dromex Chrome leather double palm elbow length 8', 40, 750, '0.00', 4000, 30, 0, 100, 0),
(1096, 1052, 'Dromex Black PU palm coated on black knitted shell', 10.67, 240, '0.00', 1280, 8, 0, 120, 0),
(1095, 1052, 'GRIPPER SEAMLESS YELLOW SHELL - CRINKLE RUBBER PALM COATED( (Handling Glove)', 11, 247.5, '0.00', 1320, 8.25, 0, 120, 0),
(1094, 1052, 'FFP2 Dust Mask SABS Approved', 3, 225, '0.00', 1200, 2.25, 0, 400, 0),
(1093, 1052, 'Dromex Ear Plug Tri Flange, Reusable', 2.67, 200, '0.00', 1066.67, 2, 0, 400, 0),
(1092, 1052, 'Dromex Cut Resistant Glove Level 5 (Black Coated))', 53.33, 480, '0.00', 2560, 40, 0, 48, 0),
(1090, 1052, 'Dromex Spectacle EURO Green adjustable Frame', 10.67, 24, '0.00', 128, 8, 0, 12, 0),
(1091, 1052, 'Dromex Spectacle EURO Clear adjustable Frame', 10.67, 96, '0.00', 512, 8, 0, 48, 0),
(1089, 1052, 'Face Shield clear complete', 39.87, 149.5, '0.00', 797.33, 29.9, 0, 20, 0),
(1087, 1052, 'Black Black Gumboot NSTC Size 7', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1088, 1052, 'Black Black Gumboot NSTC Size 6', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1086, 1052, 'Black Black Gumboot NSTC Size 8', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1085, 1052, 'Black Black Gumboot NSTC Size 9', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1084, 1052, 'Black Black Gumboot NSTC Size 10', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1083, 1052, 'Black Black Gumboot NSTC Size 11', 120, 45, '0.00', 240, 90, 0, 2, 0),
(1082, 1052, 'Black Black Gumboot NSTC Size 12', 120, 45, '0.00', 240, 90, 0, 2, 0),
(1100, 1053, 'Safety Hard Cap Blue', 17, 22.31425, '0.00', 119.01, 12.751, 0, 7, 0),
(1101, 1053, 'P2 Cartridges (Dust Cartridge)', 50.67, 190, '0.00', 1013.33, 38, 0, 20, 0),
(1102, 1053, 'Green PVC Apron Heavy Duty ', 34.67, 65.015, '0.00', 346.75, 26.006, 0, 10, 0),
(1103, 1053, 'Bata Gumboots NTSC Size 8', 152.67, 57.2525, '0.00', 305.35, 114.505, 0, 2, 0),
(1121, 1057, 'Dromex Chrome leather double palm elbow length 8inch', 40, 450, '0.00', 2400, 30, 0, 60, 0),
(1122, 1057, 'PVC Red Glove Open Cuff 40cm ', 26.67, 750, '0.00', 4000, 20, 0, 150, 0),
(1108, 1056, 'Names Embroided', 18.67, 10.5, '0.00', 56, 14, 0, 3, 0),
(1123, 1057, 'Dromex PVC Red Glove Knit Wrist', 11, 618.75, '0.00', 3300, 8.25, 0, 300, 0),
(1106, 1056, 'Trencon Logo at the Back Embroided', 46.67, 26.25, '0.00', 140, 35, 0, 3, 0),
(1107, 1056, 'Your Safety , our priority Embroided', 24, 13.5, '0.00', 72, 18, 0, 3, 0),
(1105, 1056, 'Navy / yellow Vented Reflective Mining Shirt  L', 330.67, 186, '0.00', 992, 248, 0, 3, 0),
(809, 1054, 'ICE SCOOP S/S RND L255xB185mm(80mm DEEP)HANDLE 130', 240, 45, '0.00', 240, 180, 0, 1, 0),
(808, 1054, 'ICE SCOOP S/S SQ L250xB187mm(70mm DEEP) HANDLE 130 ', 333.33, 62.5, '0.00', 333.33, 250, 0, 1, 0),
(1104, 1055, 'Boot - ELLA Daisy Chelsea - Ladies - 7014 Size 2', 635.2, 119.1, '0.00', 635.2, 476.4, 0, 1, 0),
(1118, 1057, 'FFP2 Dust Mask SABS Approved', 3, 225, '0.00', 1200, 2.25, 0, 400, 0),
(1119, 1057, 'GRIPPER SEAMLESS YELLOW SHELL - CRINKLE RUBBER PALM COATED( (Handling Glove)', 11, 247.5, '0.00', 1320, 8.25, 0, 120, 0),
(1120, 1057, 'Dromex Black PU palm coated on black knitted shell', 10.67, 240, '0.00', 1280, 8, 0, 120, 0),
(1117, 1057, 'Dromex Ear Plug Tri Flange, Reusable', 2.67, 100, '0.00', 533.33, 2, 0, 200, 0),
(1116, 1057, 'Dromex Cut Resistant Glove Level 5 (Black Coated)', 53.33, 480, '0.00', 2560, 40, 0, 48, 0),
(1113, 1057, 'Black Black Gumboot NSTC Size 6', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1114, 1057, 'Dromex Spectacle EURO Green adjustable Frame', 10.67, 24, '0.00', 128, 8, 0, 12, 0),
(1115, 1057, 'Dromex Spectacle EURO Clear adjustable Frame', 10.67, 96, '0.00', 512, 8, 0, 48, 0),
(1111, 1057, 'Black Black Gumboot NSTC Size 8', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1112, 1057, 'Black Black Gumboot NSTC Size 7', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1110, 1057, 'Black Black Gumboot NSTC Size 9', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1109, 1057, 'Black Black Gumboot NSTC Size 10', 120, 90, '0.00', 480, 90, 0, 4, 0),
(1166, 1031, 'D59 Flame Retardant & Acid Resist Trouser Size 44', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(1128, 1058, '3M 6300,Half Mask (Facepiece)', 334.67, 251, '0.00', 1338.67, 251, 0, 4, 0),
(1127, 1058, '3M 6059,Cartridge - ABEK1 -Chemical', 213.33, 320, '0.00', 1706.67, 160, 0, 8, 0),
(1124, 1058, 'Dromex PVC Rubberised Rain Suit Navy L', 120, 45, '0.00', 240, 90, 0, 2, 0),
(1125, 1058, 'FEATHER DUSTER - LONG 1840mm', 95.2, 17.85, '0.00', 95.2, 71.4, 0, 1, 0),
(1126, 1058, 'FEATHER DUSTER - MEDIUM 900mm', 82.67, 15.5, '0.00', 82.67, 62, 0, 1, 0),
(947, 1060, 'Printing On bags A6 Size', 28, 2619.75, '0.00', 13972, 21, 0, 499, 0),
(948, 1060, '12 Can Cooler with 2 Exterior Pockets 70D PEVA Lining- Size: 22 x 26.5 x 17cm', 93.33, 857.5, '0.00', 4573.33, 70, 0, 49, 0),
(949, 1060, '9 Can Wave Design Cooler - Size: 20,5 x 25 x 15,5cm', 37.33, 3150, '0.00', 16800, 28, 0, 450, 0),
(1167, 1031, 'D59 Flame Retardant & Acid Resist Trouser Size 46', 304.26, 49.608125, '0.00', 304.26, 198.4325, 0, 1, 29.764875),
(1129, 1059, 'Rags/ kg', 17, 159.375, '0.00', 850, 12.75, 0, 50, 0),
(1130, 1059, 'P2 Cartridges (Dust Cartridge)', 51.07, 191.5125, '0.00', 1021.4, 38.3025, 0, 20, 0),
(1024, 1032, 'Logo Embroidery Front Left Chest', 27.6, 27, '0.00', 165.6, 18, 0, 6, 2.7),
(1186, 1010, 'Varta Industrial AA 10 Pack ', 107.33333333333, 17.5, '0.00', 107.33, 70, 0, 1, 10.5),
(1023, 1032, 'Zee Lodge Logo Digitizing (Once off)', 383.33, 62.5, '0.00', 383.33, 250, 0, 1, 37.5),
(1131, 1061, 'Citronol Hand Cleaner with grit 30 Kg', 700, 262.5, '0.00', 1400, 525, 0, 2, 0),
(1185, 1004, 'ABEK1 Cartridge 6059 ( Comes in a ack of 2) Price per per 1			', 242.72666666667, 316.6, '0.00', 1941.81, 158.3, 0, 8, 23.745),
(1133, 1061, 'Rags/ kg', 20, 93.75, '0.00', 500, 15, 0, 25, 0),
(1132, 1061, 'Drome Chrome Leather Gloves Elbow', 40, 135, '0.00', 720, 30, 0, 18, 0),
(1203, 1062, 'AUSTRA CHELSEA Boots Brown Size 4 -12', 406.25, 81.25, '0', 406.25, 325, 0, 1, 0),
(1204, 1062, 'pogk', 375, 75, '0', 375, 300, 0, 1, 0);

-- --------------------------------------------------------

--
-- Table structure for table `tb_ledger`
--

CREATE TABLE `tb_ledger` (
  `entry_id` int NOT NULL,
  `entry_date` date NOT NULL,
  `description` text,
  `account_id` int NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `linked_type` varchar(20) DEFAULT NULL,
  `linked_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `tb_migrations`
--

CREATE TABLE `tb_migrations` (
  `id` int NOT NULL,
  `update_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `migration_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `executed_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tb_payments`
--

CREATE TABLE `tb_payments` (
  `payment_id` int NOT NULL,
  `payment_date` date DEFAULT NULL,
  `payment_amount` text,
  `payment_invoice` int DEFAULT NULL,
  `payment_processed` tinyint(1) NOT NULL DEFAULT '0',
  `processed_at` datetime DEFAULT NULL,
  `processed_by` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tb_payments`
--

INSERT INTO `tb_payments` (`payment_id`, `payment_date`, `payment_amount`, `payment_invoice`, `payment_processed`, `processed_at`, `processed_by`) VALUES
(6, '2025-02-11', '4486.64', 1004, 1, '2025-11-22 14:32:15', 2),
(7, '2025-02-25', '2371.62', 1010, 1, '2025-11-22 14:32:15', 2),
(8, '2025-03-06', '1421.89', 1014, 1, '2025-11-22 14:32:15', 2),
(9, '2025-03-19', '103321', 1019, 1, '2025-11-22 14:32:15', 2),
(11, '2025-02-07', '30240', 1011, 1, '2025-11-22 14:32:15', 2),
(15, '2025-03-18', '2136.42', 1020, 1, '2025-11-22 14:32:15', 2),
(16, '2025-03-20', '3445.32', 1023, 1, '2025-11-22 14:32:15', 2),
(17, '2025-03-25', '1885.80', 1027, 1, '2025-11-22 14:32:15', 2),
(18, '2025-04-09', '1545.59', 1029, 1, '2025-11-22 14:32:15', 2),
(19, '2025-04-11', '952.60', 1034, 1, '2025-11-22 14:32:15', 2),
(20, '2025-04-11', '316.65', 1035, 1, '2025-11-22 14:32:15', 2),
(21, '2025-04-16', '158.70', 1036, 1, '2025-11-22 14:32:15', 2),
(22, '2025-04-22', '342.57', 1037, 1, '2025-11-22 14:32:15', 2),
(23, '2025-05-07', '803.39', 1038, 1, '2025-11-22 14:32:15', 2),
(24, '2025-05-21', '4429.59', 1040, 1, '2025-11-22 14:32:15', 2),
(25, '2025-06-05', '2333.69', 1041, 1, '2025-11-22 14:32:15', 2),
(26, '2025-06-11', '5213.33', 1042, 1, '2025-11-22 14:32:15', 2),
(27, '2025-06-24', '2568.53', 1044, 1, '2025-11-22 14:32:15', 2),
(28, '2025-07-04', '3446.93', 1046, 1, '2025-11-22 14:32:15', 2),
(29, '2025-08-07', '243.23', 1045, 1, '2025-11-22 14:32:15', 2),
(30, '2025-04-03', '3650.10', 1028, 1, '2025-11-22 14:32:15', 2),
(31, '2025-08-11', '659.33', 1054, 1, '2025-11-22 14:32:15', 2),
(32, '2025-10-24', '40786.67', 1060, 1, '2025-11-22 14:32:15', 2),
(33, '2025-11-07', '3013', 1061, 1, '2025-11-22 14:32:15', 2),
(34, '2025-03-24', '1885.90', 1026, 1, '2025-11-22 14:32:15', 2),
(35, '2025-03-24', '583.20', 1025, 1, '2025-11-22 14:32:15', 2),
(36, '2025-03-24', '-45.00', 1025, 1, '2025-11-22 14:32:15', 2),
(37, '2025-03-24', '441.60', 1024, 1, '2025-11-22 14:32:15', 2),
(38, '2025-03-24', '-3003.72', 1023, 1, '2025-11-22 14:32:15', 2),
(39, '2025-03-17', '68.05', 1020, 1, '2025-11-22 14:32:15', 2),
(40, '2025-03-17', '-68.04', 1014, 1, '2025-11-22 14:32:15', 2),
(41, '2025-03-24', '138.12', 1027, 1, '2025-11-22 14:32:15', 2),
(42, '2025-04-08', '4033.20', 1030, 1, '2025-11-22 14:32:15', 2),
(43, '2025-04-09', '4033.20', 1032, 1, '2025-11-22 14:32:15', 2),
(44, '2025-04-12', '1932', 1033, 1, '2025-11-22 14:32:15', 2),
(45, '2025-04-20', '69.60', 1037, 1, '2025-11-22 14:32:15', 2),
(46, '2025-05-07', '20.81', 1038, 1, '2025-11-22 14:32:15', 2),
(47, '2025-05-20', '927.45', 1039, 1, '2025-11-22 14:32:15', 2),
(48, '2025-06-20', '1113.97', 1043, 1, '2025-11-22 14:32:15', 2),
(49, '2025-07-14', '2771.36', 1048, 1, '2025-11-22 14:32:15', 2),
(50, '2025-07-16', '3407.07', 1049, 1, '2025-11-22 14:32:15', 2),
(51, '2025-10-03', '2811.75', 1050, 1, '2025-11-22 14:32:15', 2),
(52, '2025-07-28', '3827.20', 1051, 1, '2025-11-22 14:32:15', 2),
(53, '2025-07-31', '25178.10', 1052, 1, '2025-11-22 14:32:15', 2),
(54, '2025-08-01', '2052.11', 1053, 1, '2025-11-22 14:32:15', 2),
(55, '2025-08-07', '730.48', 1055, 1, '2025-11-22 14:32:15', 2),
(56, '2025-07-22', '1449', 1056, 1, '2025-11-22 14:32:15', 2),
(57, '2025-09-29', '22578.33', 1057, 1, '2025-11-22 14:32:15', 2),
(58, '2025-09-16', '3982.69', 1058, 1, '2025-11-22 14:32:15', 2),
(59, '2025-10-06', '2152.11', 1059, 1, '2025-11-22 14:32:15', 2),
(60, '2025-04-08', '4012.57', 1031, 1, '2025-11-22 14:32:15', 2),
(61, '2025-05-08', '1', 1031, 1, '2025-11-22 14:32:15', 2);

-- --------------------------------------------------------

--
-- Table structure for table `tb_pricing`
--

CREATE TABLE `tb_pricing` (
  `pricing_id` int NOT NULL DEFAULT '0',
  `pricing_price` double DEFAULT '0',
  `pricing_note` varchar(50) DEFAULT '0',
  `pricing_item` text,
  `pricing_unit` varchar(50) DEFAULT NULL,
  `pricing_category` text NOT NULL,
  `pricing_category_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tb_pricing`
--

INSERT INTO `tb_pricing` (`pricing_id`, `pricing_price`, `pricing_note`, `pricing_item`, `pricing_unit`, `pricing_category`, `pricing_category_id`) VALUES
(2, 2.57, 'Pin', 'FFP1 Dust Mask SABS Approved', '20/box', 'Face Protection/ Respiratory', 7),
(3, 2.92, 'Hen', 'FFP2 Dust Mask SABS Approved', '20/ box', 'Face Protection/ Respiratory', 7),
(4, 4.54, 'Mic', 'FFP2V Dust Mask with valve SABS Approved', '20/ box', 'Face Protection/ Respiratory', 7),
(5, 15, 'Pin', 'FFP3V Active carbon with valve SABS Approve', '10/ box', 'Face Protection/ Respiratory', 7),
(6, 2.15, 'Hen', 'Flat Folded FFP2 NRCS Approved', '20/box', 'Face Protection/ Respiratory', 7),
(7, 1.6, 'Han', 'KN95 Mask', '10/box', 'Face Protection/ Respiratory', 7),
(8, 0.57, 'Hen', '3 ply Disposable face Mask', '50/box', 'Face Protection/ Respiratory', 7),
(9, 56.14, 'Mic', 'Dromex Single Respirator', 'Each', 'Face Protection/ Respiratory', 7),
(10, 60.82, 'Mic', 'Dromex Double Respirator', 'Each', 'Face Protection/ Respiratory', 7),
(11, 32.6, 'Pro', 'A1 Cartridges ( Solvents, Organic and petroleum fumes)', 'Each', 'Face Protection/ Respiratory', 7),
(12, 43.6, 'Pro', 'B1 Cartridges ( Fumes and mist cartridge)', 'Each', 'Face Protection/ Respiratory', 7),
(13, 38.3, 'Pro', 'P2 Cartridges (Dust Cartridge)', 'Each', 'Face Protection/ Respiratory', 7),
(14, 51.8, 'Pro', 'A1P2 Cartridges ( Combination Cartridges)', 'Each', 'Face Protection/ Respiratory', 7),
(15, 63.1, 'Pro', 'B1P2 Cartridges ( Combination Cartridges)', 'Each', 'Face Protection/ Respiratory', 7),
(17, 2.2, 'Mic', 'Dromex Ear Plug corded disposable, PU foam', '200/box', 'Ear Protection', 8),
(18, 1.32, 'Mic', 'Dromex Ear Plug uncorded disposable, PU foam', '100/box', 'Ear Protection', 8),
(19, 2.21, 'Mic', 'Dromex Ear Plug Tri Flange, Reusable', '100/box', 'Ear Protection', 8),
(20, 33.33, 'Mic', 'Ear Muff', 'Each', 'Ear Protection', 8),
(21, 8.48, 'Mic', 'Clear mono goggle direct vent', 'Each', 'Ear Protection', 8),
(22, 10.58, 'Mic', 'Clear mono goggle indirect vent', 'Each', 'Ear Protection', 8),
(23, 23.74, 'Pin', 'Flip front goggle for welding ( round lense )', 'Each', 'Ear Protection', 8),
(24, 9.71, 'Mic', 'Dromex Spectacle (Wrap Around) Clear', 'Each', 'Ear Protection', 8),
(25, 9.71, 'Mic', 'Domex Spectacle (Wrap Around) green', 'Each', 'Ear Protection', 8),
(26, 9.71, 'Mic', 'Dromex Spectacle (Wrap Around) Amber', 'Each', 'Ear Protection', 8),
(27, 9.71, 'Mic', 'Dromex Spectacle (Wrap Around) Grey', 'Each', 'Ear Protection', 8),
(28, 9.07, 'Mic', 'Dromex Spectacle EURO Grey adjustable Frame', 'Each', 'Ear Protection', 8),
(29, 9.07, 'Mic', 'Dromex Spectacle EURO Clear adjustable Frame', 'Each', 'Ear Protection', 8),
(30, 9.07, 'Mic', 'Dromex Spectacle EURO Amber adjustable Frame', 'Each', 'Ear Protection', 8),
(31, 9.07, 'Mic', 'Dromex Spectacle EURO Green adjustable Frame', 'Each', 'Ear Protection', 8),
(32, 7.91, 'Mic', 'Dromex Spectacle SPORT Style Gery', 'Each', 'Ear Protection', 8),
(33, 7.91, 'Mic', 'Dromex Spectacle SPORT Style Clear', 'Each', 'Ear Protection', 8),
(34, 7.91, 'Mic', 'Dromex Spectacle SPORT Style Green', 'Each', 'Ear Protection', 8),
(35, 7.91, 'Mic', 'Dromex Spectacle SPORT Style Amber', 'Each', 'Ear Protection', 8),
(36, 12.56, 'Mic', 'Dromex Spectacle SPORT Style Mirror', 'Each', 'Ear Protection', 8),
(37, 52.63, 'Mic', 'Maxi View goggle, anti scratch, anti fog', '10/box', 'Ear Protection', 8),
(38, 10.51, 'Hen', 'Chin strap elastic 2 point', '10/pack', 'Ear Protection', 8),
(39, 13.95, 'Hen', 'Safety Hard Cap White', 'Each', 'Ear Protection', 8),
(40, 13.95, 'Hen', 'Safety Hard Cap Blue', 'Each', 'Ear Protection', 8),
(41, 13.95, 'Hen', 'Safety Hard Cap Red', 'Each', 'Ear Protection', 8),
(42, 13.95, 'Hen', 'Safety Hard Cap Yellow', 'Each', 'Ear Protection', 8),
(43, 13.95, 'Hen', 'Safety Hard Cap Pink', 'Each', 'Ear Protection', 8),
(44, 13.95, 'Hen', 'Safety Hard Cap Grey', 'Each', 'Ear Protection', 8),
(45, 13.95, 'Hen', 'Safety Hard Cap Orange', 'Each', 'Ear Protection', 8),
(46, 13.95, 'Hen', 'Safety Hard Cap Lime', 'Each', 'Ear Protection', 8),
(47, 13.95, 'Hen', 'Safety Hard Cap Black', 'Each', 'Ear Protection', 8),
(48, 20.42, 'Hen', 'Safety hard Cap with cap lamp bracket - White', 'Each', 'Ear Protection', 8),
(49, 20.42, 'Hen', 'Safety hard Cap with cap lamp bracket - Blue', 'Each', 'Ear Protection', 8),
(50, 20.42, 'Hen', 'Safety hard Cap with cap lamp bracket - Green', 'Each', 'Ear Protection', 8),
(51, 20.42, 'Hen', 'Safety hard Cap with cap lamp bracket - Orange', 'Each', 'Ear Protection', 8),
(52, 20.42, 'Hen', 'Safety hard Cap with cap lamp bracket - Yellow', 'Each', 'Ear Protection', 8),
(53, 41.3, 'Pro', 'Face Shield clear complete', 'Each', 'Ear Protection', 8),
(54, 32.8, 'Hen', 'Flip front Welding helmet Standard', 'Each', 'Ear Protection', 8),
(56, 61.1, 'Pro', 'Blue lined  welding glove,elbow length 8\"', 'Each', 'Hand Protection', 9),
(57, 43.1, 'Pro', 'Red heat resistant apron palm welding glove,', '12/Pack', 'Hand Protection', 9),
(58, 36.1, 'Pro', 'Green lined glove wrist length 2.5\"', 'Each', 'Hand Protection', 9),
(59, 46.78, 'Mic', 'Green lined glove elbow length 8\"', 'Each', 'Hand Protection', 9),
(60, 94.6, 'Pro', 'Green lined glove Shoulder length 16\"', 'Each', 'Hand Protection', 9),
(61, 25.15, 'Mic', 'Dromex Chrome leather double palm  wrist length 2.5\"', 'Each', 'Hand Protection', 9),
(62, 31.35, 'Mic', 'Dromex Chrome leather double palm elbow length 8\"', 'Each', 'Hand Protection', 9),
(63, 69.7, 'Pro', 'Chrome leather double palm shoulder length 16\"', 'Each', 'Hand Protection', 9),
(64, 26.02, 'Mic', 'Dromex VIP TIG Glove Chrome leather', 'Each', 'Hand Protection', 9),
(65, 17.28, 'Mic', 'Dromex Chrome leather candy stripe glove', 'Each', 'Hand Protection', 9),
(66, 14.19, 'Mic', 'Dromex Miizu Glove Hi Vis Micro Foam Palm', 'Each', 'Hand Protection', 9),
(67, 14.19, 'Mic', 'Dromex Mizu Blue Glove Micro Foam Palm', 'Each', 'Hand Protection', 9),
(68, 11.22, 'Hen', 'Lime black nitrile, smooth palm coat glove', 'Each', 'Hand Protection', 9),
(69, 16.4, 'Pro', 'Lime black nitrile, sandy palm coat glove', 'Each', 'Hand Protection', 9),
(70, 11.6, 'Pro', 'Black PU palm coated glove Size 10', 'Each', 'Hand Protection', 9),
(71, 8.81, 'Mic', 'Dromex PVC Red Glove Knit Wrist', 'Each', 'Hand Protection', 9),
(72, 10.15, 'Mic', 'Dromex PVC Red Glove Open Cuff 27cm', 'Each', 'Hand Protection', 9),
(73, 12.81, 'Mic', 'Dromex PVC Red Glove Open Cuff 35cm', 'Each', 'Hand Protection', 9),
(74, 15.72, 'Hen', 'PVC Red Glove Open Cuff 40cm', 'Each', 'Hand Protection', 9),
(75, 39, 'Pro', 'PVC Brown smooth shoulder glove ', 'Each', 'Hand Protection', 9),
(76, 17.08, 'Mic', 'Dromex PVC Brown glove rough palm knit wrist', 'Each', 'Hand Protection', 9),
(77, 20.58, 'Mic', 'Dromex PVC Brown glove rough palm 27cm Open Cuff', 'Each', 'Hand Protection', 9),
(78, 25.61, 'Mic', 'Dromex PVC Brown glove rough palm 35cm Elbow', 'Each', 'Hand Protection', 9),
(79, 33.93, 'Hen', 'Black chip PVC glove knit wrist', 'Each', 'Hand Protection', 9),
(80, 31.92, 'Mic', 'Dromex Cut Resistatnd Glove Level 5', 'Each', 'Hand Protection', 9),
(81, 14.04, 'Mic', 'Green Nitrile glove open cuff', 'Each', 'Hand Protection', 9),
(82, 14.35, 'Hen', 'Black Builders Glove', '12/Pack', 'Hand Protection', 9),
(83, 23.68, 'Mic', 'Black Builders Glove 40cm', '12/pack', 'Hand Protection', 9),
(84, 7.95, 'Mic', 'Dromex Gripper green latex coat, crinkle palm glove', '12/pack', 'Hand Protection', 9),
(85, 8.97, 'Mic', 'Dromex Crayfish Glove', '12/pack', 'Hand Protection', 9),
(86, 16.21, 'Mic', 'Dromex COMAREX, yellow latex fully dipped glove, knit cuff', '12/pack', 'Hand Protection', 9),
(87, 51, 'Omn', 'Gold Hands Black Nitrile Gloves 100 pcs/box ', 'Box', 'Hand Protection', 9),
(88, 5.71, 'Mic', 'Dromex Yellow household Glove with Flock Liner', 'Per Pair', 'Hand Protection', 9),
(89, 66.7, 'Omn', 'Golden Hands Examination Gloves Powder free 100 pcs/box ', '/Box', 'Hand Protection', 9),
(90, 58.2, 'Omn', 'Golden Hands Examination Glove Powdered 100 pcs/box ', '/Box', 'Hand Protection', 9),
(91, 3.05, 'Mic', 'Dromex Cotton Glove ', 'Each', 'Hand Protection', 9),
(92, 123.75, 'Hen', 'Conti suits Royal Blue size 52', 'each', 'Work Wear and high Visibility', 10),
(93, 99, 'Hen', 'Polycotton Conti suits Royal Blue size 28-44', 'each', 'Work Wear and high Visibility', 10),
(94, 108.9, 'Hen', 'Conti suits Royal Blue size 46', 'each', 'Work Wear and high Visibility', 10),
(95, 113.85, 'Hen', 'Conti suits Royal Blue size 48', 'each', 'Work Wear and high Visibility', 10),
(96, 118.8, 'Hen', 'Conti suits Royal Blue size 50', 'each', 'Work Wear and high Visibility', 10),
(97, 123.75, 'Hen', 'Conti suits Royal Blue size 52', 'each', 'Work Wear and high Visibility', 10),
(98, 136.13, 'Hen', 'Conti suits Royal Blue size 54', 'each', 'Work Wear and high Visibility', 10),
(99, 142.31, 'Hen', 'Conti suits Royal Blue size 56', 'each', 'Work Wear and high Visibility', 10),
(100, 101, 'Hen', 'Conti suits Navy Blue/Red/White/Grey/Black size 28-44', 'each', 'Work Wear and high Visibility', 10),
(101, 111.1, 'Hen', 'Conti suits Navy Blue/Red/White/Grey/Black size 46', 'each', 'Work Wear and high Visibility', 10),
(102, 116.15, 'Hen', 'Conti suits Navy Blue/Red/White/Grey/Black size 48', 'each', 'Work Wear and high Visibility', 10),
(103, 121.2, 'Hen', 'Conti suits Navy Blue/Red/White/Grey/Black size 50', 'each', 'Work Wear and high Visibility', 10),
(104, 126.25, 'Hen', 'Conti suits Navy Blue/Red/White/Grey/Black size 52', 'each', 'Work Wear and high Visibility', 10),
(105, 138.88, 'Hen', 'Conti suits Navy Blue/Red/White/Grey/Black size 54', 'each', 'Work Wear and high Visibility', 10),
(106, 145.19, 'Hen', 'Conti suits Navy Blue/Red/White/Grey/Black size 56', 'each', 'Work Wear and high Visibility', 10),
(107, 180, 'Hen', 'Bottle Green Acid Resistant Conti Suit size 28-44', 'each', 'Work Wear and high Visibility', 10),
(108, 198, 'Hen', 'Bottle Green Acid Resistant Conti Suit size 46', 'each', 'Work Wear and high Visibility', 10),
(109, 207, 'Hen', 'Bottle Green Acid Resistant Conti Suit size 48', 'each', 'Work Wear and high Visibility', 10),
(110, 216, 'Hen', 'Bottle Green Acid Resistant Conti Suit size 50', 'each', 'Work Wear and high Visibility', 10),
(111, 225, 'Hen', 'Bottle Green Acid Resistant Conti Suit size 52', 'each', 'Work Wear and high Visibility', 10),
(112, 234, 'Hen', 'Bottle Green Acid Resistant Conti Suit size 54', 'each', 'Work Wear and high Visibility', 10),
(113, 182, 'Hen', 'Denim Coni suit size 28-44', 'each', 'Work Wear and high Visibility', 10),
(114, 200.2, 'Hen', 'Denim Coni suit size 46', 'each', 'Work Wear and high Visibility', 10),
(115, 209.3, 'Hen', 'Denim Coni suit size 48', 'each', 'Work Wear and high Visibility', 10),
(116, 218.4, 'Hen', 'Denim Coni suit size 50', 'each', 'Work Wear and high Visibility', 10),
(117, 227.5, 'Hen', 'Denim Coni suit size 52', 'each', 'Work Wear and high Visibility', 10),
(118, 236.6, 'Hen', 'Denim Coni suit size 54', 'each', 'Work Wear and high Visibility', 10),
(119, 245.7, 'Hen', 'Denim Coni suit size 56', 'each', 'Work Wear and high Visibility', 10),
(120, 254.8, 'Hen', 'Denim Coni suit size 58', 'each', 'Work Wear and high Visibility', 10),
(121, 263.9, 'Hen', 'Denim Coni suit size 60', 'each', 'Work Wear and high Visibility', 10),
(122, 169, 'Pin', 'D59 Flame Retardant & Acid Resist Jacket Size 32-44', 'each', 'Work Wear and high Visibility', 10),
(123, 186, 'Pin', 'D59 Flame Retardant & Acid Resist Jacket Size 46', 'each', 'Work Wear and high Visibility', 10),
(124, 195, 'Pin', 'D59 Flame Retardant & Acid Resist Jacket Size 48', 'each', 'Work Wear and high Visibility', 10),
(125, 205, 'Pin', 'D59 Flame Retardant & Acid Resist Jacket Size 50', 'each', 'Work Wear and high Visibility', 10),
(126, 215, 'Pin', 'D59 Flame Retardant & Acid Resist Jacket Size 52', 'each', 'Work Wear and high Visibility', 10),
(127, 225, 'Pin', 'D59 Flame Retardant & Acid Resist Jacket Size 54', 'each', 'Work Wear and high Visibility', 10),
(128, 169, 'Pin', 'D59 Flame Retardant & Acid Resist Trouser Size 28-40', 'each', 'Work Wear and high Visibility', 10),
(129, 186, 'Pin', 'D59 Flame Retardant & Acid Resist Trouser Size 42', 'each', 'Work Wear and high Visibility', 10),
(130, 195, 'Pin', 'D59 Flame Retardant & Acid Resist Trouser Size 44', 'each', 'Work Wear and high Visibility', 10),
(131, 205, 'Pin', 'D59 Flame Retardant & Acid Resist Trouser Size 46', 'each', 'Work Wear and high Visibility', 10),
(132, 222, 'Mic', 'Dromex D59 Flame and Acid Jacket All Sizes', 'each', 'Work Wear and high Visibility', 10),
(133, 222, 'Mic', 'Dromex D59 Flame and Acid Pants All Sizes', 'each', 'Work Wear and high Visibility', 10),
(134, 95, 'Hen', 'Royal Blue Dust Coat 32-44', 'each', 'Work Wear and high Visibility', 10),
(135, 110, 'Hen', 'Green Dust Coat long sleeve 32,44', 'each', 'Work Wear and high Visibility', 10),
(136, 110, 'Hen', 'White Dust Coat long sleeve Size S -4XL', 'Each', 'Work Wear and high Visibility', 10),
(137, 13.45, 'Mic', 'Dromex Maxi Reflective BIB Lime (solid material)', 'each', 'Work Wear and high Visibility', 10),
(138, 26.32, 'Mic', 'Dromex Lime Reflective Vest with Zip & ID S-4XL', 'each', 'Work Wear and high Visibility', 10),
(139, 23.32, 'Mic', 'Dromex Orange Reflective Vest with Zip & ID S- 4XL', 'each', 'Work Wear and high Visibility', 10),
(140, 47.49, 'Hen', 'Lime / Orange Two Tone Reflective Vest S- 3XL', 'each', 'Work Wear and high Visibility', 10),
(141, 47.66, 'Hen', 'Pink Reflective Vest with Zip & ID S- 3XL', 'each', 'Work Wear and high Visibility', 10),
(142, 47.66, 'Hen', 'Red Reflective Vest with Zip & ID S-3XL', 'each', 'Work Wear and high Visibility', 10),
(143, 47.66, 'Hen', 'Green Reflective Vest with Zip &  S- 3XL', 'each', 'Work Wear and high Visibility', 10),
(144, 47.66, 'Hen', 'Blue Reflective Vest with Zip & ID S- 3XL', 'each', 'Work Wear and high Visibility', 10),
(145, 199, 'Pin', 'HiViz All Weather Jacket Lime/ Navy/Orange Ref', 'each', 'Work Wear and high Visibility', 10),
(146, 235, 'Pin', 'Navy Blue Freezer Jacket M- 2XL', 'each', 'Work Wear and high Visibility', 10),
(147, 190, 'Pin', 'Navy Blue Freezer Trouser M-2XL', 'each', 'Work Wear and high Visibility', 10),
(148, 500, 'Pin', 'Bunny Jacket Lime S - 5XL', 'each', 'Work Wear and high Visibility', 10),
(149, 500, 'Pin', 'Bunny Jacket Orange S - 5XL', 'each', 'Work Wear and high Visibility', 10),
(150, 500, 'Pin', 'Bunny Jacket Navy S - 5XL', 'each', 'Work Wear and high Visibility', 10),
(151, 28, 'Hen', 'Disposable coverall 40GSM with zip & hood S-3XL', '50/Pack', 'Work Wear and high Visibility', 10),
(152, 50, 'Mic', 'Dromex Disposable overall Type 4/5/6, M- 3XL', '50/Pack', 'Work Wear and high Visibility', 10),
(153, 20, 'Omn', 'Mop Cap  All Colours 18\"', '100/pack', 'Work Wear and high Visibility', 10),
(154, 26.6, 'Omn', 'Mop Cap  All Colours 21\"', '100/pack', 'Work Wear and high Visibility', 10),
(155, 18, 'Omn', 'Disposable Shoe Cover P.E /100', NULL, 'Work Wear and high Visibility', 10),
(156, 53.9, 'Pro', 'Disposable Shoe Cover / 100', '1000/box', 'Work Wear and high Visibility', 10),
(157, 37, 'Omn', 'Beard Cover White /100', '100/pack', 'Work Wear and high Visibility', 10),
(158, 25, 'Pin', 'Green PVC Apron Heavy Duty 400gm', 'each', 'Work Wear and high Visibility', 10),
(159, 25, 'Pin', 'Yellow PVC Apron Heavy Duty 400gm', 'each', 'Work Wear and high Visibility', 10),
(160, 25, 'Pin', 'White PVC Apron Heavy Duty 400gm', 'each', 'Work Wear and high Visibility', 10),
(161, 25, 'Pin', 'Red PVC Apron Heavy Duty 400gm', 'each', 'Work Wear and high Visibility', 10),
(162, 93.57, 'Mic', 'Dromex PVC Rubberised Rain Suit Navy S- 4XL', 'each', 'Work Wear and high Visibility', 10),
(163, 93.57, 'Mic', 'Dromex PVC Rubberised Rain Suit Yellow S- 4XL', 'each', 'Work Wear and high Visibility', 10),
(164, 93.57, 'Mic', 'Dromex PVC Rubberised Rain Suit Olive Black S- 4XL', 'each', 'Work Wear and high Visibility', 10),
(165, 93.57, 'Mic', 'PVC Rubberised Rain Suit Navy with Reflective Tape S-3XL', 'each', 'Work Wear and high Visibility', 10),
(166, 137, 'Hen', 'PVC Rubberised Rain Suit Lime with Reflective Tape S-3XL', 'each', 'Work Wear and high Visibility', 10),
(167, 137, 'Hen', 'PVC Rubberised Rain Suit Olive with Reflective Tape S-3XL', 'each', 'Work Wear and high Visibility', 10),
(168, 78.36, 'Mic', 'PVC Rubberised Rain Coat Yellow M-3XL', 'each', 'Work Wear and high Visibility', 10),
(169, 78.36, 'Mic', 'PVC Rubberised Rain Coat Navy M-3XL', 'each', 'Work Wear and high Visibility', 10),
(170, 317.8, 'Hen', 'Chrome Leather Welding Jacket S-4XL', 'each', 'Work Wear and high Visibility', 10),
(171, 317.8, 'Hen', 'Chrome Leather Trouser M-3XL', 'each', 'Work Wear and high Visibility', 10),
(172, 86.9, 'Pro', 'Chrome Leather Welding Apron 1 piece 90 x 60', 'each', 'Work Wear and high Visibility', 10),
(173, 99.4, 'Pro', 'Chrome Leather Welding Apron 1 piece  60x 120', 'each', 'Work Wear and high Visibility', 10),
(174, 149.71, 'Mic', 'Chrome Leather Yoke L-2XL', 'each', 'Work Wear and high Visibility', 10),
(175, 176.3, 'Hen', 'Chrome Leather Yoke 3XL-4XL', 'Each', 'Work Wear and high Visibility', 10),
(176, 34.4, 'Pro', 'Chrome Leather Ankle Spats', 'Per Pair', 'Work Wear and high Visibility', 10),
(177, 70.73, 'Hen', 'Chrome Leather Knee Spats ', 'Per Pair', 'Work Wear and high Visibility', 10),
(178, 145, 'pin', 'Metro Reflective Jacket Detachable Sleeve S-2XL', 'each', 'Work Wear and high Visibility', 10),
(179, 253.8, 'Mic', 'Dromex Navy / Orange Vented Reflecticve Mining Shirt S-3XL', 'each', 'Work Wear and high Visibility', 10),
(180, 253.8, 'Mic', 'Dromex Navy / yellow Vented Reflective Mining Shirt S-3XL', 'each', 'Work Wear and high Visibility', 10),
(181, 253.8, 'Mic', 'Dromex Navy Vented Reflective Mining Shirt S-3XL', 'each', 'Work Wear and high Visibility', 10),
(182, 253.8, 'Mic', 'Dromex Royal Blue Vented Reflective Mining Shirt S-3XL', 'each', 'Work Wear and high Visibility', 10),
(183, 253.8, 'Mic', 'Dromex Navy / Royal Vented Reflective Mining Shirt S-3L', 'each', 'Work Wear and high Visibility', 10),
(184, 139, 'Hen', 'Royal Blue Boiler Suit Polycotton size 32-44', 'each', 'Work Wear and high Visibility', 10),
(185, 278, 'Pin', 'Single lanyard full body harness with snap hook', 'each', 'Heights and Site', 11),
(186, 300, 'Hen', 'Single lanyard full body harness with snap hook', 'each', 'Heights and Site', 11),
(187, 340, 'Hen', 'Double lanyard full body harness with snap hook', 'each', 'Heights and Site', 11),
(188, 420, 'Hen', 'Double lanyard full body harness with scaffold hook', 'each', 'Heights and Site', 11),
(189, 70, 'Pin', 'Miners Cap Lamp Belt S-L (Rise by size from XL)', 'each', 'Heights and Site', 11),
(190, 69.01, 'Mic', 'Dromex Kidney Belt size S -2XL', 'each', 'Heights and Site', 11),
(191, 490, 'Hen', 'First Aid Kit Regulaion 3 with metal box', 'each', 'Heights and Site', 11),
(192, 192, 'Hen', 'Motorist First Aid Kit', 'each', 'Heights and Site', 11),
(193, 520, 'Hen', 'First Aid Kit Regulaion 7 with metal box', 'each', 'Heights and Site', 11),
(194, 185, 'Hen', 'First Aid Refill Regulaion 3', 'each', 'Heights and Site', 11),
(195, 215, 'Hen', 'First Aid Refill Regulaion 7', 'each', 'Heights and Site', 11),
(196, 315, 'Hen', 'Empty Metal Box for First Aid', 'each', 'Heights and Site', 11),
(197, 325, 'Pin', 'AUSTRA CHELSEA Boots Brown Size 4 -12', 'per pair', 'Footwear', 12),
(198, 330, 'Pin', 'AUSTRA CHELSEA Boots Brown Size 4 -12', 'per pair', 'Footwear', 12),
(199, 330, 'Pin', 'AUSTRA CHELSEA Boots Black Size 4 -12', 'Per Pair', 'Footwear', 12),
(200, 347.37, 'Mic', 'DROMEX BOXER CHELSEA BOOT BLACK, SIZE 3-13', 'Per Pair', 'Footwear', 12),
(201, 190, 'Pin', 'ROKOLO safety shoe Size 3-12', 'Per Pair', 'Footwear', 12),
(202, 200, 'Pin', 'ROKO CHUKKA Boots Size 3 -12', 'Per Pair', 'Footwear', 12),
(203, 327.6, 'Pro', 'Rebel Kontrakta Boot size 3-14', 'Per Pair', 'Footwear', 12),
(204, 327.6, 'Pro', 'Rebel Kontrakta Boot size 3-13', 'Per Pair', 'Footwear', 12),
(205, 212.87, 'Mic', 'DROMEX BOXER BLACK SAFETY BOOT', 'Per Pair', 'Footwear', 12),
(206, 789.47, 'Mic', 'DROMEX FLITE SNEAKER SIZE 4-13', 'Per Pair', 'Footwear', 12),
(207, 771.93, 'Mic', 'DROMEX FLITE LADIES SNEAKER SIZE 2- 9', 'Per Pair', 'Footwear', 12),
(208, 837, 'Pro', 'Bova Chelsea Boot Size 3-13 Bulk', 'Bulk', 'Footwear', 12),
(209, 874.7, 'Pro', 'Bova Chelsea Boot Size 3-13 ', 'Per Pair', 'Footwear', 12),
(210, 25.9, 'Pro', 'Freezer Heavy Duty socks full length', 'per pair', 'Footwear', 12),
(211, 114.5, 'Pro', 'Wayne Duralight Black Gumboot NSTC Size 3-13', 'Per Pair', 'Footwear', 12),
(212, 164.4, 'Pro', 'Wayne Gripper Gumboot STC Size 3-13', 'Per Pair', 'Footwear', 12),
(213, 170.7, 'Pro', 'Wayne Gripper Gumboots White/Red Size 3-13', 'Per Pair', 'Footwear', 12);

-- --------------------------------------------------------

--
-- Table structure for table `tb_quotations`
--

CREATE TABLE `tb_quotations` (
  `quotation_id` int NOT NULL,
  `quotation_contact_id` int NOT NULL DEFAULT '0',
  `quotation_total` double DEFAULT '0',
  `quotation_updated` bigint DEFAULT NULL,
  `quotation_subtotal` double DEFAULT '0',
  `quotation_vat` double DEFAULT '0',
  `quotation_discount` double DEFAULT '0',
  `quotation_date` date DEFAULT NULL,
  `quotation_valid_until` date DEFAULT NULL,
  `quotation_notes` text,
  `quotation_email` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `quotation_status` int NOT NULL DEFAULT '0',
  `quotation_user_id` int NOT NULL DEFAULT '0',
  `quotation_time` int NOT NULL,
  `quotation_subject` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tb_quotations`
--

INSERT INTO `tb_quotations` (`quotation_id`, `quotation_contact_id`, `quotation_total`, `quotation_updated`, `quotation_subtotal`, `quotation_vat`, `quotation_discount`, `quotation_date`, `quotation_valid_until`, `quotation_notes`, `quotation_email`, `quotation_status`, `quotation_user_id`, `quotation_time`, `quotation_subject`) VALUES
(118, 2, 10795.94, 1746442082, 10795.94, 0, 0, '2025-01-13', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your amended quotation attached.</p><p>I hope this meets your approval, looking forward to your feedback.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1736768273, 'Quote 118'),
(119, 8, 27591.93, 1736936998, 27591.93, 0, 0, '2025-01-15', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. (No Vat) :)</p><p>I would appreciate your feedback on the quote.</p><p>Thank you.</p><p><br></p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1736924252, 'PPE for the month Quote 119'),
(120, 8, 46732.32, 1737553248, 46732.32, 0, 0, '2025-01-15', '2025-01-31', 'Notes', '                                                                                    <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Price adjusted</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1736937022, 'FFP2 flat folded Quote 120- Revised'),
(121, 8, 25217.39, 1744212448, 25217.39, 0, 0, '2025-01-15', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                        <p>Good day Zoe,\r\n                            </p><p>Please find your amended quotation attached. Revised</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1736937205, 'PPE Conti Suits and Shirts Quote 121 Price Adjusted'),
(122, 9, 17909.48, 1737620133, 17909.48, 0, 0, '2025-01-20', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day Sinah,\r\n                            </p><p>Please find your quotation attached, </p><p>I would appreciate your feedback if you require any adjustments.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1737371160, 'Quote122 PPE and Branding Adjusted'),
(123, 8, 5303.51, 1737379003, 5303.51, 0, 0, '2025-01-20', '2025-01-31', 'Notes', '                                                                                    <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1737376898, 'Quote 123'),
(124, 10, 910.79, 1737381035, 910.79, 0, 0, '2025-01-20', '2025-01-31', 'Notes', '                                                        <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached. I will attach images shortly of what each shirt looks like.</p><p><br></p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1737380199, 'Quote 124'),
(125, 29, 4013.57, 1744210421, 4013.57, 0, 0, '2025-01-20', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                            <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached :)</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1737382554, 'Quote 125 - Updated'),
(126, 11, 970.59, 1737451407, 970.59, 0, 0, '2025-01-21', '2025-01-31', 'Notes', '                                                                                                                                            <p>Good day Amit,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1737448779, 'Quote 126'),
(127, 12, 5934, 1746441966, 5934, 0, 0, '2025-01-22', '2025-01-31', 'Notes', '                                                                                                                                                                        <p>Good day Bernadette,\r\n                            </p><p>Please find your quotation attached. Please note that from size 46(Chest size) Price rise by size.</p><p>I quoted on 2 different types: Polycotton and 80/20 to choose from</p><p><br></p><p>Looking forward to receiving your feedback :)</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1737531708, 'Quote 127'),
(128, 13, 10427.74, 1737539449, 10427.74, 0, 0, '2025-01-22', '2025-01-31', 'Notes', '                                                                                                                <p>Good day Brian,\r\n                            </p><p>Please find your quotation attached. Please let me know if i can do any adjustments for you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1737538498, 'Quote 128 - boots'),
(129, 8, 3054.91, 1737552824, 3054.91, 0, 0, '2025-01-22', '2025-01-31', 'Notes', '                                                        <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. I tried to go down on some items.</p><p><br></p><p>Please let me know if you would like me to do any other adjustments.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1737551459, 'Quote 129'),
(130, 14, 708.4, 1737704327, 708.4, 0, 0, '2025-01-24', '2025-01-31', 'Notes', '                                                                                    <p>Good day Abel,\r\n                            </p><p>Please find your quotation attached. Please note that prices rise by size from size 46 upwards.</p><p><br></p><p>Please let me know if you require any adjustments made.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1737703852, 'Quote 130- Dromex Flame/Acid resistant'),
(131, 15, 415325.94, 1737989556, 415325.94, 0, 0, '2025-01-27', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day Malose,\r\n                            </p><p>Please find your quotation attached.&nbsp; Please let me know if you would like me to do some adjustments.</p><p><br></p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1737984754, 'Quote 131- Complete'),
(132, 8, 1691.27, 1738044444, 1691.27, 0, 0, '2025-01-28', '2025-01-31', 'Notes', '                                                                                                                <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Please note that I quoted on 1 Piece Overalls.</p><p>I can still source the 2 Piece for you if you give me more time :) (They are Scarce).</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738043898, 'Quote 132 Disposables'),
(133, 16, 14484.93, 1738059572, 14484.93, 0, 0, '2025-01-28', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                                                                                                    <p>Good day Nico,\r\n                            </p><p>Please find your quotation attached.&nbsp;</p><p>Please let me know if you would like me to adjust anything.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738048792, 'Quote 133  PPE Completd'),
(134, 2, 36592.41, 1738146774, 36592.41, 0, 0, '2025-01-28', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Please note that Sisi Coral has been discontinued by the manufacturer.</p><p>Please let me know if you would like me to adjust anything for you. Your feedback will be highly appreciated.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738060940, 'Quote 134 Boots'),
(135, 10, 0, NULL, 0, 0, 0, '2025-01-28', '2025-01-31', NULL, NULL, 0, 0, 1738091345, NULL),
(136, 9, 0, NULL, 0, 0, 0, '2025-01-28', '2025-01-31', NULL, NULL, 0, 0, 1738091552, NULL),
(137, 15, 1114.87, 1738142744, 1114.87, 0, 0, '2025-01-29', '2025-01-31', 'Notes', '                                                                                    <p>Good day Steve,\r\n                            </p><p>Please find your quotation attached. Please note that prices on Banding are an estimate depending on the colours of your logo and quantities, price could vary.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1738141277, 'Quote 137 - Estimate'),
(138, 14, 34918.51, 1739369280, 34918.51, 0, 272.9, '2025-01-29', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Abel,\r\n                            </p><p>Please find your quotation attached. Please note that we do not charge VAT.</p><p>All Prices have been discounted</p><p>Your feedback will be much appreciated.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738153898, 'Quote 138 PPE - Adjusted- Price Drop'),
(139, 8, 8065.91, 1738231986, 8065.91, 0, 0, '2025-01-30', '2025-01-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Awaiting to hear from you soon.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738224944, 'Quote 139 PPE Adjusted'),
(140, 17, 3134.13, 1738236040, 3134.13, 0, 0, '2025-01-30', '2025-01-31', 'Notes', '                                                        <p>Good day Adri,\r\n                            </p><p>Please find your quotation attached. Please note that WE DO NOT CHARGE VAT.</p><p>I hope to hear from you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1738235402, 'Quote 140'),
(141, 18, 22711.38, 1738656173, 22711.38, 0, 0, '2025-02-03', '2025-02-28', 'Notes', '                                                                                                                                            <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached for the Barron Shirt and the Equivalent as an option.</p><p>Your response would be much appreciated.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738587163, 'Quote 141 Shirts'),
(142, 2, 4486.53, 1741603677, 4486.53, 0, 0, '2025-02-04', '2025-02-28', 'Notes', '                                                                                                                                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1738660795, 'Quote 142 P2 Cartridges '),
(143, 18, 303776.49, 1738675461, 303776.49, 0, 0, '2025-02-04', '2025-02-28', 'Notes', '                                                        <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached. Your feedback will be much appreciated.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1738674287, 'Quote 143  Motors'),
(144, 18, 30240, 1742545262, 30240, 0, 0, '2025-02-05', '2025-02-28', 'Notes', '                                                                                                                                                                        <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1738746514, 'Quote 144 40cm Gloves'),
(145, 10, 20681.6, 1738749256, 20681.6, 0, 0, '2025-02-05', '2025-02-28', 'Notes', '                                                                                                                                            <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached. Will send artwork for your approval shortly.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738748208, 'Quote 145 Hiviz Shirts + Embroidery'),
(146, 19, 665.42, 1738840098, 665.42, 0, 0, '2025-02-06', '2025-02-28', 'Notes', '                                                                                                                <p>Good day Jerry,\r\n                            </p><p>Please find your quotation attached with Options on the set.</p><p>I will send Specs on each on a separate email. Looking forward to hearing your feedback.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1738839170, 'Quote 1146'),
(147, 8, 84330.27, 1739181923, 84330.27, 0, 0, '2025-02-10', '2025-02-28', 'Notes', '                                                                                    <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Your Feedback will be much appreciated.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1739181646, 'Quote 147 Projector'),
(148, 20, 5050.34, 1739785160, 5050.34, 0, 0, '2025-02-11', '2025-02-28', 'Notes', '                                                                                                                                                                                                    <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached, Please note i Quoted you on Different brands, Please let me know which one would you prefer.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1739271581, 'Quote148- D59- Chelsea'),
(149, 8, 14323.65, 1739288285, 14323.65, 0, 0, '2025-02-11', '2025-02-28', 'Notes', '                                                                                                                <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached, Apologies for the late one i was out of the office.</p><p>Please let me know if my pricing needs adjusting, I a willing to match/Beat any quote.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1739287041, 'Quote 149 - Dromex- Chelsea'),
(150, 8, 3861.74, 1739428651, 3861.74, 0, 10.54, '2025-02-13', '2025-02-28', 'Notes', '                                                        <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Please keep in mind that my price are without Vat and we do not charge Vat.</p><p>Please let me know if anything needs t be adjusted.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1739427411, 'Quote 150'),
(151, 19, 620, 1739432291, 620, 0, 0, '2025-02-13', '2025-02-28', 'Notes', '                                                                                                                                            <p>Good day Zodwa,</p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1739431887, 'Quote 151'),
(152, 2, 2589.45, 1739454354, 2589.45, 0, 0, '2025-02-13', '2025-02-28', 'Notes', '                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>  Please let me know if you would like me to adjust anything</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1739439427, 'Quote 152 - Adjusted'),
(153, 2, 994.98, 1739456253, 994.98, 0, 0, '2025-02-13', '2025-02-28', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.&nbsp; I will send images shortly.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1739455710, 'Quote 153 Fans'),
(154, 15, 1281.72, 1739784283, 1281.72, 0, 0, '2025-02-17', '2025-02-28', 'Notes', '                                                                                                                <p>Good day Ash,\r\n                            </p><p>Please find your quotation attached. Please let me know if i need to adjust anything.</p><p>Your feedback would be much appreciated.</p><p>Please note that we do Not charge VAT</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1739782706, 'Quote154'),
(155, 2, 6252.08, 1739791969, 6252.08, 0, 0, '2025-02-17', '2025-02-28', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Images sent already</p><p>Your feedback would much appreciated.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1739791488, 'Quote 155 Industrial Fans'),
(156, 21, 2230.26, 1741071633, 2230.26, 0, 0, '2025-02-19', '2025-02-28', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                <p>Good day Yusuf,\r\n                            </p><p>Please find your adjusted quotation attached. Please note that we DO NOT CHARGE VAT</p><p>Your feedback will be much appreciated .</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><p><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</p><p><strong style=\"letter-spacing: 0.05em;\">W:</strong><span style=\"letter-spacing: 0.05em;\"> </span><a href=\"http://softaware.co.za/\" style=\"background-color: rgb(255, 255, 255); letter-spacing: 0.05em;\">www.softaware.co.za</a></p></td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1739953561, 'Quote 156- Adjusted '),
(157, 8, 39866.67, 1739968704, 39866.67, 0, 0, '2025-02-19', '2025-02-28', 'Notes', '                                                        <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1739968208, ''),
(158, 2, 2371.6, 1742806912, 2371.6, 0, 0, '2025-02-20', '2025-02-28', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. PLEASE NOTE THAT WE DO NOT CHARGE VAT.</p><p>Looking forward to hearing from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1740037620, 'Quote 158'),
(159, 22, 45970.24, 1740482386, 45970.24, 0, 0, '2025-02-25', '2025-02-28', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <p>Good day Rachel,\r\n                            </p><p>Please find your quotation attached. Please not that we DO NOT CHARGE VAT.</p><p>I will send the Welding items on a separate quotation shortly.</p><p>Looking forward to hear from you, Please let me know should my prices be out, i am willing to match/beat any quote :)</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1740467955, 'Quote159'),
(160, 22, 2313.47, 1740483645, 2313.47, 347.02, 0, '2025-02-25', '2025-02-28', 'Notes', '                                                                                                                                                                        <p>Good day Rachel,\r\n                            </p><p>Please find your quotation attached as per previous mail.</p><p>Please remember our Prices do not have Vat.</p><p>Looking forward to hearing from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1740482405, 'Quote 160 '),
(161, 2, 1456.67, 1740488814, 1456.67, 0, 0, '2025-02-25', '2025-02-28', 'Notes', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached asper picture</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1740488370, 'Quote 161'),
(162, 2, 13070.9, 1741586319, 13070.9, 0, 0, '2025-02-26', '2025-02-28', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Please remember , we do not charge VAT.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1740557523, 'Quote 162'),
(163, 8, 18887.34, 1740566136, 18887.34, 0, 0, '2025-02-26', '2025-02-28', 'Notes', '                                                                                    <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1740564045, 'Quote 163 PPE'),
(164, 8, 16775.4, 1740566891, 16775.4, 0, 0, '2025-02-26', '2025-02-28', 'Notes', '                                                        <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Please remember WE NO NOT CHARGE VAT.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1740566429, 'Quote 164'),
(165, 2, 0, NULL, 0, 0, 0, '2025-02-27', '2025-02-28', NULL, NULL, 0, 0, 1740675580, NULL),
(166, 8, 124807.2, 1740676099, 124807.2, 0, 0, '2025-02-27', '2025-02-28', 'Notes', '                                                        <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Please let me know if my pricing is out then i can see if i am able to adjust to be in.</p><p>Please remember we do not charge vat</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1740675776, 'Quote 166 Respirators');
INSERT INTO `tb_quotations` (`quotation_id`, `quotation_contact_id`, `quotation_total`, `quotation_updated`, `quotation_subtotal`, `quotation_vat`, `quotation_discount`, `quotation_date`, `quotation_valid_until`, `quotation_notes`, `quotation_email`, `quotation_status`, `quotation_user_id`, `quotation_time`, `quotation_subject`) VALUES
(167, 18, 5322303.96, 1740813507, 5322303.96, 0, 0, '2025-02-28', '2025-02-28', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached. Please let me know if you require any adjustments or amendments.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1740727310, 'Quote 167'),
(168, 23, 10317.8, 1740732829, 10317.8, 0, 0, '2025-02-28', '2025-02-28', 'Notes', '                                                        <p>Good day Leonie,</p><p>Please find your quotation attached. Please note that we do not charge vat at the moment.</p><p>Please let me know if you need any adjustments on the quote.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1740731854, 'Quote 168'),
(169, 2, 4072.53, 1741078429, 4072.53, 0, 0, '2025-03-04', '2025-03-31', 'Notes', '                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. </p><p>Looking forward to the PO :)</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1741076841, 'Quote 169'),
(170, 2, 1476.6, 1741084114, 1476.6, 0, 0, '2025-03-04', '2025-03-31', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Please let me know if i need to do any adjustments</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1741084014, 'Quote 170 Cotton Gloves Revised'),
(171, 24, 2246.64, 1741609966, 2246.64, 0, 0, '2025-03-10', '2025-03-31', 'Notes', '                                                        <p>Good day Themba,\r\n                            </p><p>Please find your quotation attached. Please let me know should you require any further assistance.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1741609797, 'Quite 171 Ref Vests'),
(172, 18, 1324.8, 1741676197, 1324.8, 0, 0, '2025-03-11', '2025-03-31', 'Notes', '                                                        <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached. Please let me know should the quote require any adjustments .</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1741675659, 'Quote 172 '),
(173, 2, 1353.93, 1742806727, 1353.93, 0, 0, '2025-03-11', '2025-03-31', 'Notes', '                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1741676536, ''),
(174, 2, 10170.88, 1742807176, 10170.88, 0, 0, '2025-03-11', '2025-03-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Please let me know if you require anything else.</p><p>Your feedback will be much appreciated.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1741699550, 'Quote 174 Final'),
(175, 25, 2932.08, 1741765969, 2932.08, 0, 0, '2025-03-12', '2025-03-31', 'Notes', '                                                                                    <p>Good day Trisha,\r\n                            </p><p>Please find your quotation attached. Please note that we do not Charge VAT at the moment.</p><p>&nbsp;I am looking forward to your response. I will send you our Price List and Specials Shortly.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1741765228, 'Quite 175 Earplugs & Dispenser'),
(176, 18, 103320.36, 1742194982, 103320.36, 0, 0, '2025-03-14', '2025-03-31', 'Notes', '                                                                                    <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached. </p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 2, 1, 1741963660, 'Quote 176 - PVC Gloves'),
(177, 26, 53035.5, 1742285767, 53035.5, 0, 0, '2025-03-17', '2025-03-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Otto,\r\n                            </p><p>Please find your quotation attached. Please note that prices can be negotiable based on quantities.</p><p>Also note that we do not charge VAT at the moment. The price you see is the price you pay.</p><p>Looking forward to your feedback.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1742212074, 'Quote 177- Adjusted'),
(178, 2, 6551.23, 1742820438, 6551.23, 0, 0, '2025-03-18', '2025-03-31', 'Notes', '                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1742305632, 'Quote 178 Adjusted'),
(179, 2, 2606.67, 1742392962, 2606.67, 0, 0, '2025-03-19', '2025-03-31', 'Notes', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1742392650, 'Quote 178 Urn'),
(180, 27, 16865.5, 1742910520, 16865.5, 0, 0, '2025-03-25', '2025-03-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <p>Good day Lindy,\r\n                            </p><p>Please find your quotation attached. Please remember we do not charge VAT.</p><p>I am looking forward to hearing from you, i am willing to match/ beat any price.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1742886527, 'Quote 180'),
(181, 8, 6420.72, 1743056212, 6420.72, 0, 0, '2025-03-27', '2025-03-31', 'Notes', '                                                                                    <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Please remember that the prices are as they are, No VAT to be added.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1743055613, 'Quote 181'),
(182, 2, 11127.1, 1744616195, 11127.1, 0, 0, '2025-03-28', '2025-03-31', 'Notes', '                                                                                                                                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Looking forward to your response.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1743144112, 'Quote 182 Adjusted'),
(183, 2, 804.08, 1743147958, 804.08, 0, 0, '2025-03-28', '2025-03-31', 'Notes', '                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached for PVC Shoulder</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1743147617, 'Quote 183'),
(184, 17, 11544.77, 1743149838, 11544.77, 0, 0, '2025-03-28', '2025-03-31', 'Notes', '                                                        <p>Good day Adri,\r\n                            </p><p>Please find your quotation attached. Looking forward to your favorable response.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1743149591, 'Quote 184 Boots'),
(185, 22, 7038, 1743499755, 7038, 0, 0, '2025-04-01', '2025-04-30', 'Notes', '                                                                                                                                                                                                                                <p>Good day Rachel,\r\n                            </p><p>Please find your quotation attached. Please note we not charge VAT.</p><p>Looking forward to your feedback :)</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1743488376, 'Quote 185 Barron Mens Shirts- Branded'),
(186, 2, 13600.66, 1743492031, 13600.66, 0, 0, '2025-04-01', '2025-04-30', 'Notes', '                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. No VAt Charged.</p><p>Please let me know if any adjustments can be made.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1743491090, 'Quote 186  Boots/Shoes'),
(187, 2, 952.81, 1743492260, 952.81, 0, 0, '2025-04-01', '2025-04-30', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 1, 1, 1743492083, 'Quote187 Rebel Welding boot'),
(188, 10, 6698.99, 1743755147, 6698.99, 0, 0, '2025-04-02', '2025-04-30', 'Notes: \r\n', '                                                                                                                                                                                                                                                                                        <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached. Please remember that we do not charge VAT.</p><p>Please let me know if any adjustments required.</p><p>Quote for the Nylon Ropes to Follow</p><p>Thank you </p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1743584805, 'Quite188- No Vat Charged'),
(189, 10, 11040, 1743676585, 11040, 0, 0, '2025-04-03', '2025-04-30', 'Notes', '                                                        <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached.</p><p>Looking forward to hear from you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1743676403, 'Quote189 - Harness- No VAT Charged'),
(190, 28, 7977.73, 1744006120, 7977.73, 0, 0, '2025-04-04', '2025-04-30', 'Notes', '                                                                                                                                                                                                                                                                                                                                                <p>Good day Mpume,\r\n                            </p><p>Please find your quotation attached. Your feedback will be much appreciated.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1743761308, 'Quote 190 '),
(191, 8, 2209.66, 1744004906, 2209.66, 0, 0, '2025-04-07', '2025-04-30', 'Notes', '                                                                                                                <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached , Please note that these are rain Coats (Jacket only as per request).</p><p>Please confirm if that is the item you require and not Rain Suits (2 Piece)</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1744004168, 'Quote 191 - Rain COATS'),
(192, 18, 8490.72, 1744034568, 8490.72, 0, 0, '2025-04-07', '2025-04-30', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                        <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached. I look forward to hearing from you :)</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1744027531, 'Quote192'),
(193, 29, 1545.59, 1744183445, 1545.59, 0, 0, '2025-04-08', '2025-04-30', 'Notes', '                                                                                                                                            <p>Good day Malose,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1744112093, 'Quote 193 - Freezer Jackets'),
(194, 2, 2534.7, 1745301810, 2534.7, 0, 0, '2025-04-08', '2025-04-30', 'Notes', '                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1744120975, 'Quote 194'),
(195, 30, 4033.2, 1744272124, 4033.2, 0, 0, '2025-04-08', '2025-04-30', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1744122523, 'Quote 195 Zee Lodge- Amended'),
(196, 29, 3042.05, 1744608780, 3042.05, 0, 0, '2025-04-11', '2025-04-30', 'Notes', '                                                                                                                                                                        <p>Good day Malose,\r\n                            </p><p>Please find your quotation attached for Jackets + Ebmroidery.</p><p><br></p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1744374089, 'Quote 196 - Jakcets'),
(197, 15, 3311.92, 1744628765, 3311.92, 0, 0, '2025-04-14', '2025-04-30', 'Notes\r\nTo: Dunlop Belting', '                                                                                    <p>Good day Sheila,\r\n                            </p><p>Please find your quotation attached. Please note that i have quoted you on Equivalents from Barron. Images will follow shortly.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1744628479, 'Quote 197 - Equivalent'),
(198, 8, 20441.31, 1744797733, 20441.31, 0, 0, '2025-04-16', '2025-04-30', 'Notes', '                                                                                                                                                                                                                                                                                                                                                <p>Good day Zoe,\r\n                            </p><p>Please find your quotation attached. Awaiting Logo to quote on Branding.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1744793476, 'Quote 198 - Without Branding'),
(199, 30, 342.57, 1745310553, 342.57, 0, 0, '2025-04-22', '2025-04-30', 'Notes', '                                                                                                                                            <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1745305291, 'Quote 199'),
(200, 31, 2295.4, 1745399572, 2295.4, 0, 0, '2025-04-23', '2025-04-30', 'Notes', '                                                                                                                                            <p>Good day Sheila,\r\n                            </p><p>Please find your quotation attached. Looking forward to your feedback.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1745398162, 'Quote 200'),
(201, 20, 5213.3295, 1749710275, 4533.33, 680, 0, '2025-04-23', '2025-06-30', 'Notes', '                                                                                                                                                                                                                                                                                                                    <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1745413351, 'Quote 201'),
(202, 2, 3826.53, 1746605734, 3826.53, 573.98, 0, '2025-04-25', '2025-04-30', 'Notes', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1745563331, 'Quote 202'),
(203, 13, 108866.67, 1745937134, 108866.67, 0, 0, '2025-04-29', '2025-04-30', 'Notes', '                                                                                    <p>Good day Brian,\r\n                            </p><p>Please find your quotation attached. Please remember&nbsp; no vat is charged&nbsp; on this quote.</p><p>Looking forward to hearing from you, Your Feedback will be much Appreciated.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1745935973, 'Quote 203'),
(204, 2, 76.67, 1746512757, 76.67, 11.5, 0, '2025-05-05', '2025-05-31', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1746425069, ''),
(206, 30, 927.452, 1747810754, 806.48, 120.97, 0, '2025-05-08', '2025-05-31', 'Notes', '                                                                                                                                                                                                                                                                                        <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached. Please remember the R69.60 that was outstanding from the previous invoice</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1746701879, ''),
(207, 32, 37073.401000000005, 1747041782, 32237.74, 4835.66, 0, '2025-05-09', '2025-05-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Marisa,\r\n                            </p><p>Please find your quotation attached. I am still waiting for pricing on the other items.</p><p>I am looking forward to your feedback on what has been quoted. Please let me know if there are any adjustments to be made :)</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1746777795, 'Quote 207- Adjusted'),
(208, 15, 3108.0589999999997, 1746791785, 2702.66, 405.4, 0, '2025-05-09', '2025-05-31', 'Notes', '                                                                                                                <p>Good day Mpho,\r\n                            </p><p>Please find your quotation attached.</p><p>Looking forward to your feedback.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1746791647, 'Quote 208');
INSERT INTO `tb_quotations` (`quotation_id`, `quotation_contact_id`, `quotation_total`, `quotation_updated`, `quotation_subtotal`, `quotation_vat`, `quotation_discount`, `quotation_date`, `quotation_valid_until`, `quotation_notes`, `quotation_email`, `quotation_status`, `quotation_user_id`, `quotation_time`, `quotation_subject`) VALUES
(209, 15, 33961.811499999996, 1747043327, 29532.01, 4429.8, 0, '2025-05-12', '2025-05-31', 'Notes', '                                                                                                                <p>Good day Mpho,\r\n                            </p><p>Please find your quotation attached.</p><p>Your Feedback will be much appreciated.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1747041884, 'Quote 209'),
(210, 13, 2704.9495, 1747129273, 2352.13, 352.82, 0, '2025-05-13', '2025-05-31', 'Notes', '                                                                                    <p>Good day Brian,\r\n                            </p><p>Please find your quotation attached.</p><p>Your feedback will be much appreciated.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1747129009, 'Quote 210'),
(211, 15, 15838.2485, 1747209558, 13772.39, 2065.86, 0, '2025-05-14', '2025-05-31', 'Notes', '                                                                                    <p>Good day Thenji</p><p>Please find your quotation attached. The Acid Resistant ones are a bot pricey. Please advise if you would like me to quote on the regular ones.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1747209257, 'Quote 211'),
(212, 2, 8904.818, 1747811148, 7743.32, 1161.5, 0, '2025-05-14', '2025-05-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Please advise if anything needs adjustment.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1747228976, 'Quote212'),
(213, 15, 2191.808, 1747309099, 1905.92, 285.89, 0, '2025-05-15', '2025-05-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <p>Good day Joey,\r\n                            </p><p>Please find your quotation attached. Please let me know if any adjustments are required.</p><p>Looking forward to hearing from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1747297516, 'Quote 213'),
(214, 15, 802.1825000000001, 1747318439, 697.55, 104.63, 0, '2025-05-15', '2025-05-31', 'Notes', '                                                                                                                <p>Good day Daniel,\r\n                            </p><p>Please find your quotation attached. Please let me know how my pricing is.</p><p>Looking forward to your response.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1747317455, 'Quote 214'),
(215, 15, 50255, 1747665826, 43700, 6555, 0, '2025-05-19', '2025-05-31', 'Notes', '                                                                                                                                            <p>Good day Thenjie,\r\n                            </p><p>Please find your quotation attached. Please note that I have quoted you on what we can supply.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1747664267, 'Quote 215'),
(216, 13, 493.7295, 1747734634, 429.33, 64.4, 0, '2025-05-20', '2025-05-31', 'Notes', '                                                        <p>Good day Brian,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 1, 1, 1747734406, 'Quote 216'),
(217, 15, 735305.7564999999, 1747831949, 639396.31, 95909.45, 0, '2025-05-21', '2025-05-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <p>Good day Vincent,\r\n                            </p><p>Please find your quotation attached. Please let me know should you Require any info or adjustments.</p><p>Looking forward to hearing from you.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1747828630, 'Quote 217'),
(218, 33, 1595.8205, 1747989843, 1387.67, 208.15, 0, '2025-05-23', '2025-05-31', 'Notes', '                                                                                                                                                                        <p>Good day Bianca,\r\n                            </p><p>Please find your quotation attached on options that we an supply.</p><p>Please feel free to contact me if you have any questions. Looking forward to your favorable response.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1747988635, 'Quote 218'),
(219, 11, 1371.8694999999998, 1747996686, 1192.93, 178.94, 0, '2025-05-23', '2025-05-31', 'Notes', '                                                        <p>Good day Poko,\r\n                            </p><p>Please find your quotation attached. Looking forward to your response/Feedback</p><p>Thank you</p><p><span style=\"letter-spacing: 0.05em;\">Kind regards,</span></p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1747996302, 'Quote 219'),
(220, 10, 11668.337, 1748328781, 10146.38, 1521.96, 0, '2025-05-27', '2025-05-31', 'Notes', '                                                                                                                                                                                                                                                                                        <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached.</p><p>Looking forward to hearing from you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1748326564, 'Quote 220'),
(221, 2, 7938.668500000001, 1749030158, 6903.19, 1035.48, 0, '2025-06-03', '2025-06-30', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1748941686, 'Quote 221'),
(222, 10, 793.5, 1749037864, 690, 103.5, 0, '2025-06-04', '2025-06-30', 'Notes', '                                                        <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached.</p><p>Looking forward to hearing from you.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1749037517, 'Quote 222'),
(223, 34, 1607.5849999999998, 1749043296, 1397.9, 209.68, 0, '2025-06-04', '2025-06-30', 'Notes', '                                                                                                                <p>Good day Nikitta,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1749041771, ''),
(224, 29, 0, NULL, 0, 0, 0, '2025-06-09', '2025-06-30', NULL, NULL, 0, 0, 1749450174, NULL),
(225, 2, 2300, 1749540996, 2000, 300, 0, '2025-06-10', '2025-06-30', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Keep your heater on there it\'s Freezing.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1749540693, 'Quote 225'),
(226, 35, 10097.850999999997, 1749661166, 8780.74, 1317.11, 0, '2025-06-10', '2025-06-30', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Dolly/Sibusiso,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1749562693, ''),
(227, 2, 377.2, 1749630735, 328, 49.2, 0, '2025-06-11', '2025-06-30', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 1, 1, 1749630623, 'Quote 227'),
(228, 36, 2520.8, 1749727550, 2192, 328.8, 0, '2025-06-12', '2025-06-30', 'Notes', '                                                                                                                                                                                                                                <p>Good day Klaas,\r\n                            </p><p>Please find your quotation attached. Please let me know if there are any adjustments you would like, Looking forward to hearing from you.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1749712254, 'Quote 228 - Adjusted CAL 15'),
(229, 10, 4739.5295, 1751011298, 4121.33, 618.2, 0, '2025-06-17', '2025-06-30', 'Notes', '                                                                                                                                            <p>Good day Rose.</p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1750153521, 'Quote 229'),
(230, 10, 8277.24, 1750156690, 7197.6, 1079.64, 0, '2025-06-17', '2025-06-30', 'Notes', '                                                                                    <p>Good day Rose.</p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1750156522, 'Quote 230'),
(231, 37, 9200, 1750167054, 8000, 1200, 0, '2025-06-17', '2025-06-30', 'Notes', '                                                                                    <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 0, 1, 1750166731, ''),
(232, 2, 3252.1884999999997, 1750400774, 2827.99, 424.2, 0, '2025-06-18', '2025-06-30', 'Notes', '                                                                                                                                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1750235901, 'Quote 232 - Adjusted'),
(233, 37, 326.28950000000003, 1750680604, 283.73, 42.56, 0, '2025-06-19', '2025-06-30', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <p>Good day Devi,</p><p>Thank you for seeing me Yesterday. It was a pleasure to  meet you,</p><p>\r\n                            </p><p>Please find your quotation attached. The Glove is on the last Line, Please let me know if any adjustments are to be made.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1750346700, 'Quote 233 - '),
(234, 39, 2726.2705, 1750413220, 2370.67, 355.6, 0, '2025-06-20', '2025-06-30', 'Notes', '                                                                                    <p>Good day Tean,\r\n                            </p><p>Please find your quotation attached. Please let me know if you require any adjustments made.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1750412737, 'Quote 234'),
(235, 37, 4791.2564999999995, 1750664509, 4166.31, 624.95, 0, '2025-06-23', '2025-06-30', 'Notes', '                                                                                                                <p>Good day Devi,</p><p>I hoe you are well.</p><p>\r\n                            </p><p>Please find your quotation attached. Please let me know if any info is required.&nbsp;</p><p>Looking forward to your feedback regarding pricing.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1750663503, 'Quote 235 '),
(236, 15, 805000, 1750752440, 700000, 105000, 0, '2025-06-23', '2025-06-30', 'Notes', '                                                                                                                                            <p>Good day Zoe,</p><p>I hope you are well, Woow nice to hear from you  :)</p><p>\r\n                            </p><p>Please find your quotation attached. We don\'t keep the bush hats in Grey.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1750701420, 'Quote 236'),
(237, 18, 5626.67, 1750927976, 5626.67, 0, 0, '2025-06-26', '2025-06-30', 'Notes', '                                                                                                                                                                                                    <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1750926385, ''),
(238, 15, 1579.3294999999998, 1750931194, 1373.33, 206, 0, '2025-06-26', '2025-06-30', 'Notes', '                                                                                    <p>Good day Nonhlanhla,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 0, 1, 1750930819, ''),
(239, 37, 243.0295, 1751011154, 211.33, 31.7, 0, '2025-06-27', '2025-06-30', 'Notes', '                                                                                    <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, 1751005977, ''),
(240, 18, 123744.6, 1751279775, 107604, 16140.6, 0, '2025-06-30', '2025-06-30', 'Notes', '                                                                                    <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, 1751279670, ''),
(241, 2, 3246.312, 1751283422, 2822.88, 423.43, 0, '2025-06-30', '2025-06-30', 'Notes', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Looking forward to your response.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1751282120, 'Quote 241'),
(242, 37, 3151.759, 1751284837, 2740.66, 411.1, 0, '2025-06-30', '2025-06-30', 'Notes\r\nAcc No: CAR001', '                                                                                                                                                                                                    <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1751283514, ''),
(243, 42, 86555.1295, 1751467626, 75265.33, 11289.8, 0, '2025-07-02', '2025-07-31', 'Notes', '                                                                                                                                                                                                                                                            <p>Good day Clive,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1751465279, ''),
(244, 15, 0, NULL, 0, 0, 0, '2025-07-03', '2025-07-31', NULL, NULL, 0, 0, 1751529180, NULL),
(245, 15, 0, NULL, 0, 0, 0, '2025-07-03', '2025-07-31', NULL, NULL, 0, 0, 1751529338, NULL),
(246, 2, 1613.0705, 1751896247, 1402.67, 210.4, 0, '2025-07-07', '2025-07-31', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1751893576, ''),
(247, 43, 5669.5, 1751985720, 4930, 739.5, 0, '2025-07-08', '2025-07-31', 'Notes', '                                                                                                                                            <p>Good day Dominique,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1751983634, ''),
(248, 2, 2513.1295, 1752564622, 2185.33, 327.8, 0, '2025-07-14', '2025-07-31', 'Notes', '                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1752490136, ''),
(249, 44, 11199.4705, 1752565095, 9738.67, 1460.8, 0, '2025-07-14', '2025-07-31', 'Notes', '                                                                                                                                                                        <p>Good day Hanry,\r\n                            </p><p>Please find your quotation attached with Embroidery included.</p><p>looking forward to your favorable response.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1752500807, 'Quote 249 - With Embroidery'),
(250, 15, 4773.9375, 1752659384, 4151.25, 622.69, 0, '2025-07-16', '2025-07-31', 'Notes', '                                                                                    <p>Good day Thenji,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, 1752659187, ''),
(251, 37, 2811.75, 1753197736, 2445, 366.75, 0, '2025-07-22', '2025-07-31', 'Notes\r\nOrder Number: PO28079', '                                                                                    <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, 1753197526, ''),
(252, 15, 1922.4895000000001, 1753198872, 1671.73, 250.76, 0, '2025-07-22', '2025-07-31', 'Notes', '                            <p>Good day Thenji,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                        ', 0, 1, 1753198715, ''),
(253, 45, 1841.7595000000001, 1753271176, 1601.53, 240.23, 0, '2025-07-23', '2025-07-31', 'Notes', '                                                        <p>Good day France,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1753269986, ''),
(254, 37, 1951.9295, 1754666707, 1697.33, 254.6, 0, '2025-07-23', '2025-07-31', 'Notes', '                                                                                    <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 2, 1, 1753271442, ''),
(255, 2, 1138.5, 1753430651, 990, 148.5, 0, '2025-07-25', '2025-07-31', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1753430336, ''),
(256, 45, 379.1780000000001, 1753714650, 329.72, 49.46, 0, '2025-07-28', '2025-07-31', 'Notes', '                                                        <p>Good day France,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1753714128, ''),
(257, 20, 3827.2, 1753799697, 3328, 499.2, 0, '2025-07-29', '2025-07-31', 'Notes', '                                                                                                                                            <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1753778918, ''),
(258, 2, 7987.141, 1753945031, 6945.34, 1041.8, 0, '2025-07-29', '2025-07-31', 'Notes', '                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1753795811, 'Quote 258'),
(259, 45, 1280.3294999999998, 1753885060, 1113.33, 167, 0, '2025-07-30', '2025-07-31', 'Notes', '                                                                                                                <p>Good day France,\r\n                            </p><p>Please find your quotation attached for the Signage.</p><p>Looking forward to hearing from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1753884697, 'Quote 259'),
(260, 20, 1166.2725, 1753885522, 1014.15, 152.12, 0, '2025-07-30', '2025-07-31', 'Notes', '                                                        <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1753885312, ''),
(261, 45, 25178.1, 1754040602, 21894, 3284.1, 0, '2025-07-30', '2025-07-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day France,\r\n                            </p><p>Please find your quotation attached for the listed PPE.</p><p>Please note that these are the best (Bulk) prices that I have quoted you.</p><p>Looking forward to your favorable response - I will send images for the different Gloves quoted.</p><p>Thank you!</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1753886113, 'Quote 261');
INSERT INTO `tb_quotations` (`quotation_id`, `quotation_contact_id`, `quotation_total`, `quotation_updated`, `quotation_subtotal`, `quotation_vat`, `quotation_discount`, `quotation_date`, `quotation_valid_until`, `quotation_notes`, `quotation_email`, `quotation_status`, `quotation_user_id`, `quotation_time`, `quotation_subject`) VALUES
(262, 45, 368, 1753958786, 320, 48, 0, '2025-07-31', '2025-07-31', 'Notes', '                                                        <p>Good day France,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1753954449, ''),
(263, 2, 2052.1175000000003, 1754318334, 1784.45, 267.67, 0, '2025-08-01', '2025-08-31', 'Notes', '                                                                                                                                                                        <p>Good day Muzi,</p><p>Apologies for the late response, please see attached Quotation for the Gumboots.</p><p>Looking forward to hear from you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1754047346, 'quote 263'),
(264, 20, 5723.952499999999, 1754670206, 4977.35, 746.6, 0, '2025-08-04', '2025-08-31', 'Notes\r\nReference: Philadi', '                                                                                                                                                                                                                                <p>Good day Thabiso,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1754296096, ''),
(265, 2, 993.9105, 1754375450, 864.27, 129.64, 0, '2025-08-05', '2025-08-31', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Please note that this is a special order item.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1754374946, 'Quote 265'),
(266, 37, 4584.7395, 1754480104, 3986.73, 598.01, 0, '2025-08-06', '2025-08-31', 'Notes', '                                                                                    <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached for the Hand Blowers. I will send a specification of each one quoted.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1754478636, 'Quote 266'),
(267, 45, 6440, 1754482748, 5600, 840, 0, '2025-08-06', '2025-08-31', 'Notes', '                                                                                                                <p>Good day France,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1754482153, ''),
(268, 46, 1569.75, 1754669612, 1365, 204.75, 0, '2025-08-08', '2025-08-31', 'Notes', '                                                                                                                                                                        <p>Good day Leanne,\r\n                            </p><p>Please find your quotation attached. Apologies, we did not have Power earlier, Only got back late this afternoon.</p><p>I look forward to hearing from you</p><p>Have an awesome weekend.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1754668506, 'Quote 268'),
(269, 20, 466.9, 1754994448, 406, 60.9, 0, '2025-08-11', '2025-08-31', 'Notes\r\nRefence: Philadi', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1754918214, ''),
(270, 10, 1449, 1756273604, 1260, 189, 0, '2025-08-11', '2025-08-31', 'Notes', '                                                                                                                <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1754918989, ''),
(271, 37, 3956, 1754925636, 3440, 516, 0, '2025-08-11', '2025-08-31', 'Notes', '                                                                                                                <p>Good day Devi,\r\n                            </p><p data-start=\"124\" data-end=\"346\">Please see attached quotation for scoops, my usual supplier is low on stock at the moment. But no worries, I have managed to source the same items from another supplier. They are a bit more expensive, but I’ll keep the prices the same for you.</p><p>\r\n</p><p data-start=\"348\" data-end=\"485\">The only thing is, I will need payment for this order to be made via EFT or cash so I can go ahead and get the items from the new supplier as I have no relationship&nbsp; with them.</p><p>Looking forward to hearing from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1754920278, 'Quite 271  Scoops'),
(272, 2, 1674.4, 1755255529, 1456, 218.4, 0, '2025-08-15', '2025-08-31', 'Notes', '                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                        ', 0, 1, 1755253200, ''),
(273, 45, 1107.0705, 1755619609, 962.67, 144.4, 0, '2025-08-18', '2025-08-31', 'Notes', '                                                                                                                                            <p>Good day France,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1755525837, ''),
(274, 10, 40786.6705, 1760948323, 35466.67, 5320, 0, '2025-08-20', '2025-10-31', 'Notes', '                                                                                                                                                                                                                                                                                                                                                                                                                                    <p>Good day Zenobia,\r\n                            </p><p>Please find your quotation attached for the Bags and the caps with Branding.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1755684030, 'Quote 274'),
(275, 37, 843.3295, 1755786257, 733.33, 110, 0, '2025-08-21', '2025-08-31', 'Notes', '                                                        <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached.&nbsp;</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1755786147, 'Quote 725- Oil Test Refill'),
(276, 15, 1548.6589999999999, 1755846893, 1346.66, 202, 0, '2025-08-22', '2025-08-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day Thenji,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1755846233, 'Quote 276'),
(277, 2, 5879.352, 1756386483, 5112.48, 766.87, 0, '2025-08-28', '2025-08-31', 'Notes', '                                                                                                                                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1756383956, 'Quote 277'),
(278, 45, 22633.5295, 1756715304, 19681.33, 2952.2, 0, '2025-09-01', '2025-09-30', 'Notes', '                                                                                                                <p>Good day France,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1756713317, ''),
(279, 37, 3496, 1757056017, 3040, 456, 0, '2025-09-05', '2025-09-30', 'Notes', '                                                                                                                                            <p>Good day Devi,\r\n                            </p><p>Please find your quotation attached for the gloves.</p><p>This month- September will have to be on COD basis, we ae also pushing on our side to get credit from the supplier so we can also be able to supply on credit hopefully from next month-October.</p><p>Thank you</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1757055418, 'Quote 279 - Gloves'),
(280, 15, 0, NULL, 0, 0, 0, '2025-09-08', '2025-09-30', NULL, NULL, 0, 0, 1757311153, NULL),
(281, 13, 3793.9305000000004, 1757408685, 3299.07, 494.86, 0, '2025-09-09', '2025-09-30', 'Notes', '                                                        <p>Good day Brian,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1757408240, 'Quote 281'),
(282, 2, 4463.2305, 1758007511, 3881.07, 582.16, 0, '2025-09-11', '2025-09-30', 'Notes', '                                                                                                                                                                                                    <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1757583183, ''),
(283, 2, 8126.6705, 1758197559, 7066.67, 1060, 0, '2025-09-18', '2025-09-30', 'Notes', '                            <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                        ', 0, 1, 1758197092, ''),
(284, 15, 2681.0525, 1758272737, 2331.35, 349.7, 0, '2025-09-19', '2025-09-30', 'Notes', '                                                                                    <p>Good day Thenji,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1758272339, 'Quote 284'),
(285, 15, 2054.6705, 1758617189, 1786.67, 268, 0, '2025-09-23', '2025-09-30', 'Notes', '                                                                                    <p>Good day Sir</p><p>Please find your quotation attached.</p><p>Please double check sizes and confirm.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1758616033, 'Quote 285'),
(286, 47, 2342.7915000000003, 1758636212, 2037.21, 305.58, 0, '2025-09-23', '2025-09-30', 'Notes', '                                                                                                                                                                        <p>Good day Lizelle,\r\n                            </p><p>Please find your quotation attached.</p><p>Looking forward tohear from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1758635620, 'Quote 286'),
(287, 18, 5600, 1758792520, 5600, 0, 0, '2025-09-23', '2025-09-30', 'Notes', '                                                                                                                                            <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached 3M Reflective Tape.</p><p>Lead time would be in Jan 2026</p><p>Looking forward to hear from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1758652431, 'Quote 287- 3M Ref Tape'),
(288, 2, 6834.8640000000005, 1759743873, 5943.36, 891.5, 0, '2025-10-01', '2025-10-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Looking forward to hear from you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1759320857, 'Quote 288'),
(289, 45, 1599.2704999999999, 1759489287, 1390.67, 208.6, 0, '2025-10-03', '2025-10-31', 'Notes', '                                                                                                                                                                                                                                <p>Good day France,\r\n                            </p><p>Please find your quotation attached. Will send the price for the Fire Blanket Shortly.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1759479932, 'Quote 289'),
(290, 13, 2415, 1759486805, 2100, 315, 0, '2025-10-03', '2025-10-31', 'Notes', '                                                        <p>Good day Brian,\r\n                            </p><p>Please find your quotation attached for Reflective Jackets with Embroidery.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                        ', 1, 1, 1759486594, 'Quote 290'),
(291, 13, 1407.6, 1760012237, 1224, 183.6, 0, '2025-10-09', '2025-10-31', 'Notes', '                                                                                                                <p>Good day Brian</p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1760011994, 'Quote 291'),
(292, 2, 569.1695000000001, 1760513453, 494.93, 74.24, 0, '2025-10-15', '2025-10-31', 'Notes', '                                                                                                                <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1760510414, ''),
(293, 48, 1831.2024999999999, 1760516713, 1592.35, 238.85, 0, '2025-10-15', '2025-10-31', 'Notes', '                                                                                                                                                                        <p>Good day Victoria,\r\n                            </p><p>Please find your quotation attached. Please note that i Quoted you on a Dromex Brand I will send Specifications for you to see. Please let me know if all is n order.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1760511297, 'Quote 293'),
(294, 49, 2246.9965, 1760525494, 1953.91, 293.09, 0, '2025-10-15', '2025-10-31', 'Notes', '                                                                                                                                                                                                                                                                                        <p>Good day Thenji,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1760520153, 'Quote 294'),
(295, 48, 12921.4, 1761041876, 11236, 1685.4, 0, '2025-10-21', '2025-10-31', 'Notes', '                                                                                    <p>Good day Victoria,\r\n                            </p><p>Please find your quotation attached for Conti Suits.</p><p>Looking forward to your feedback.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                        ', 1, 1, 1761041183, 'Quote 295'),
(296, 2, 478.66450000000003, 1761117919, 416.23, 62.43, 0, '2025-10-21', '2025-10-31', 'Notes', '                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1761054336, 'Quote 296'),
(297, 50, 2677.6715000000004, 1761141151, 2328.41, 349.26, 0, '2025-10-22', '2025-10-31', 'Notes', '                                                                                                                                            <p>Good day Rohan,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 0, 1, 1761139237, ''),
(298, 50, 804.5515, 1761142012, 699.61, 104.94, 0, '2025-10-22', '2025-10-31', 'Notes', '                                                                                    <p>Good day Rohan,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                        ', 0, 1, 1761141210, ''),
(299, 18, 401.51, 1761214224, 401.51, 0, 0, '2025-10-23', '2025-10-31', 'Notes', '                                                                                                                                                                        <p>Good day Taby,\r\n                            </p><p>Please find your quotation attached.</p><p>Kind regards,</p><table border=\'0\'><tr>\r\n    <td style=\'padding-right: 10px;\'><img src=\'https://softaware.co.za/assets/images/logo_small.png\'/></td>\r\n    <td style=\'border-left:1px solid #666; padding-left: 10px;\'><strong>Naledi</strong><br/><strong>E:</strong> sales@softaware.co.za <br/><strong>P:</strong> 060 725 9924</td>\r\n    <tr></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 2, 1, 1761212519, ''),
(300, 2, 8892.720000000001, 1762236293, 7732.8, 1159.92, 0, '2025-11-03', '2025-11-30', 'Notes', '                                                                                                                                                                        <p>Good day Muzi,\r\n                            </p><p>Please find your quotation attached. Lookingforward to hearing from you.</p><p>Thank you.</p><p>Kind regards,</p><table border=\"0\"><tbody><tr>\r\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/assets/images/logo_small.png\"></td>\r\n    <td style=\"border-left:1px solid #666; padding-left: 10px;\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\r\n    </tr><tr></tr></tbody></table> \r\n                         \r\n                         \r\n                         \r\n                         \r\n                         \r\n                        ', 1, 1, 1762162425, 'Quote 300'),
(301, 34, 558.21, 1762638973, 485.4, 72.81, 0, '2025-11-08', '2025-12-08', 'Testing', '', 2, 1, 1762637508, ''),
(302, 25, 948.75, NULL, 825, 123.75, 0, '2025-11-08', '2025-12-08', 'Vat:223', NULL, 2, 1, 1762640344, NULL),
(303, 35, 74.4625, NULL, 0, 9.7125, 0, '2025-11-09', '2025-12-09', '', NULL, 0, 1, 1762709730, NULL),
(305, 2, 1966.5, NULL, 1710, 256.5, 0, '2025-11-28', '2025-12-28', '', NULL, 0, 2, 1764323742, NULL),
(306, 67, 1006.55, NULL, 1006.55, 0, 2, '2026-01-12', '2026-02-11', '', NULL, 0, 2, 1768238521, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tb_quote_items`
--

CREATE TABLE `tb_quote_items` (
  `item_id` int NOT NULL,
  `item_quote_id` int NOT NULL,
  `item_product` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `item_price` double DEFAULT '0',
  `item_profit` double NOT NULL DEFAULT '0',
  `item_discount` text,
  `item_subtotal` double NOT NULL DEFAULT '0',
  `item_cost` double NOT NULL DEFAULT '0',
  `item_supplier_id` int DEFAULT '0',
  `item_qty` int NOT NULL DEFAULT '1',
  `item_vat` double NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3;

--
-- Dumping data for table `tb_quote_items`
--

INSERT INTO `tb_quote_items` (`item_id`, `item_quote_id`, `item_product`, `item_price`, `item_profit`, `item_discount`, `item_subtotal`, `item_cost`, `item_supplier_id`, `item_qty`, `item_vat`) VALUES
(10586, 121, 'Navy / Orange Vented Reflecticve Mining Shirt M', 328.13, 642, '0.00', 3937.6, 214, 0, 12, 32.1),
(11007, 118, 'Glue Devil - Spray Paint - Electric Blue', 55.31, 41.48, '0.00', 221.23, 41.48, 0, 4, 0),
(11006, 118, 'Glue Devil - Spray Paint - Grass Green ', 55.31, 41.48, '0.00', 221.23, 41.48, 0, 4, 0),
(11005, 118, 'A-Grade Cleaning Rag   (5KG PACK) ', 26.87, 125.9375, '0.00', 671.67, 20.15, 0, 25, 0),
(11004, 118, 'Chrome leather double palm glove wrist length 2.5', 37.57, 169.08, '0.00', 901.76, 28.18, 0, 24, 0),
(11003, 118, 'Red heat resistant apron palm welding glove,', 102.73, 462.3, '0.00', 2465.6, 77.05, 0, 24, 0),
(11002, 118, 'Blue lined yellow palm welding glove', 107.33, 301.875, '0.00', 1610, 80.5, 0, 15, 0),
(11001, 118, 'Safety Hard Cap White', 21.4, 20.0625, '0.00', 107, 16.05, 0, 5, 0),
(11000, 118, 'Ear Plug Tri Flange, Reusable', 4.4, 165, '0.00', 880, 3.3, 0, 200, 0),
(10999, 118, 'FFP2 Dust Mask SABS Approved', 3.68, 138, '0.00', 736, 2.76, 0, 200, 0),
(10998, 118, 'Broom platform 450mm HARD - BROWN', 168.05, 157.55, '0.00', 840.27, 126.04, 0, 5, 0),
(10997, 118, 'Broom platform 450mm SOFT', 168.05, 157.55, '0.00', 840.27, 126.04, 0, 5, 0),
(10585, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 32', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(10583, 121, 'Navy / Orange Vented Reflective Mining Shirt XL', 328.13, 321, '0.00', 1968.8, 214, 0, 6, 32.1),
(10584, 121, 'Navy / Orange Vented Reflective Mining Shirt L', 328.13, 321, '0.00', 1968.8, 214, 0, 6, 32.1),
(10582, 121, 'Navy / Orange Vented Reflective Mining Shirt XXL', 328.13, 214, '0.00', 1312.53, 214, 0, 4, 32.1),
(10581, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 34', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(10580, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 36', 277.28, 135.628125, '0.00', 831.85, 180.8375, 0, 3, 27.125625),
(10579, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 38', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(10578, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 40', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(10577, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 42', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(10576, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 44', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(10575, 121, 'D59 Flame Retardant & Acid Resist Jacket Size 48', 375.59, 183.7125, '0.00', 1126.77, 244.95, 0, 3, 36.7425),
(10574, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 30', 277.28, 135.628125, '0.00', 831.85, 180.8375, 0, 3, 27.125625),
(10573, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 32', 277.28, 135.628125, '0.00', 831.85, 180.8375, 0, 3, 27.125625),
(10572, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 34', 277.28, 406.884375, '0.00', 2495.56, 180.8375, 0, 9, 27.125625),
(10571, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 36', 277.28, 271.25625, '0.00', 1663.71, 180.8375, 0, 6, 27.125625),
(10570, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 38', 277.28, 271.25625, '0.00', 1663.71, 180.8375, 0, 6, 27.125625),
(10569, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 40', 277.28, 135.628125, '0.00', 831.85, 180.8375, 0, 3, 27.125625),
(10568, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 42', 277.28, 271.25625, '0.00', 1663.71, 180.8375, 0, 6, 27.125625),
(10567, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 46', 304.26, 148.824375, '0.00', 912.79, 198.4325, 0, 3, 29.764875),
(987, 120, 'Flat Folded FFP2 NRCS Approved', 9.74, 7619.399999999999, '0.00', 46732.32, 6.3495, 0, 4800, 0.952425),
(10566, 121, 'D59 Flame Retardant & Acid Resist Trouser Size 48', 319.25, 156.155625, '0.00', 957.75, 208.2075, 0, 3, 31.231125),
(575, 119, 'Safety hard Cap with cap lamp bracket - Yellow', 29.13, 27.3125, '0.00', 145.67, 21.85, 0, 5, 0),
(574, 119, 'Safety hard Cap with cap lamp bracket - White', 29.13, 27.3125, '0.00', 145.67, 21.85, 0, 5, 0),
(573, 119, 'Cap Lamp Belt Padded &  Shoulder Straps ', 589.33, 884, '0.00', 4714.67, 442.75, 0, 8, 0),
(572, 119, 'Lime Reflective Vest with Zip & ID XXL', 52.13, 9.775, '0.00', 52.13, 39.1, 0, 1, 0),
(571, 119, 'Lime Reflective Vest with Zip & ID XL', 52.13, 19.55, '0.00', 104.27, 39.1, 0, 2, 0),
(569, 119, 'Rebel Kontrakta Boots Size 11', 502.79, 188.545, '0.00', 1005.57, 377.09, 0, 2, 0),
(570, 119, 'Lime Reflective Vest with Zip & ID L', 52.13, 19.55, '0.00', 104.27, 39.1, 0, 2, 0),
(568, 119, 'Rebel Kontrakta Boots Size 10', 502.79, 282.8175, '0.00', 1508.36, 377.09, 0, 3, 0),
(567, 119, 'Rebel Kontrakta Boots Size 9', 502.79, 471.3625, '0.00', 2513.93, 377.09, 0, 5, 0),
(564, 119, 'Rebel Kontrakta Boots Size 6', 502.79, 471.3625, '0.00', 2513.93, 377.09, 0, 5, 0),
(565, 119, 'Rebel Kontrakta Boots Size 7', 502.79, 377.09, '0.00', 2011.15, 377.09, 0, 4, 0),
(566, 119, 'Rebel Kontrakta Boots Size 8', 502.79, 282.8175, '0.00', 1508.36, 377.09, 0, 3, 0),
(561, 119, ' Lime sun brimm protector for hard hat with reflective ', 136.47, 127.9375, '0.00', 682.33, 102.35, 0, 5, 0),
(562, 119, 'Clear mono goggle direct vent', 16.11, 72.48, '0.00', 386.56, 12.08, 0, 24, 0),
(563, 119, 'Spectacle SPORT Style Clear', 15.24, 137.16, '0.00', 731.52, 11.43, 0, 48, 0),
(560, 119, 'Clear Face cover for Hard hat clip On', 48.31, 9.0575, '0.00', 48.31, 36.23, 0, 1, 0),
(559, 119, 'Yellow Rubberized rain Suit Size L', 147.2, 55.2, '0.00', 294.4, 110.4, 0, 2, 0),
(558, 119, 'Yellow Rubberized rain Suit Size XL', 147.2, 82.8, '0.00', 441.6, 110.4, 0, 3, 0),
(557, 119, 'Miners Socks Heavey Duty full length', 41.01, 299.91, '0.00', 1599.52, 30.76, 0, 39, 0),
(555, 119, 'Cut Resistatnd Glove Level 5', 59.8, 538.2, '0.00', 2870.4, 44.85, 0, 48, 0),
(556, 119, 'Ear Plug uncorded disposable, PU foam', 3.37, 63.25, '0.00', 337.33, 2.53, 0, 100, 0),
(554, 119, 'Gumboots STC Size 4', 161.33, 121, '0.00', 645.33, 121.9, 0, 4, 0),
(552, 119, 'Gumboots STC Size 8', 161.33, 121, '0.00', 645.33, 121.9, 0, 4, 0),
(553, 119, 'Gumboots STC Size 6', 161.33, 121, '0.00', 645.33, 121.9, 0, 4, 0),
(551, 119, 'Gumboots STC Size 10', 161.33, 121, '0.00', 645.33, 121.9, 0, 4, 0),
(549, 119, 'Gumboots STC Size 12', 161.33, 121, '0.00', 645.33, 121.9, 0, 4, 0),
(550, 119, 'Gumboots STC Size 11', 161.33, 121, '0.00', 645.33, 121.9, 0, 4, 0),
(1078, 122, 'Horizon Shirts Short Sleeve Tripple Stitched L', 395.6, 64.5, '0.00', 395.6, 258.9, 0, 1, 38.7),
(1077, 122, 'Horizon Shirts Short Sleeve Tripple Stitched - Stone M', 398.51, 64.975, '0.00', 398.51, 259.9, 0, 1, 38.985),
(1076, 122, 'Bump Caps', 104.27, 204, '0.00', 1251.2, 68.25, 0, 12, 10.2),
(1075, 122, 'Logo Caps (Drop)', 23, 45, '0.00', 276, 15, 0, 12, 2.25),
(1074, 122, 'Logo at the back (Wording)', 58.27, 142.5, '0.00', 874, 38, 0, 15, 5.7),
(1073, 122, 'Logo Left thigh (wording)', 26.07, 51, '0.00', 312.8, 17, 0, 12, 2.55),
(1072, 122, 'Logo Front Chest (Drop)', 23, 56.25, '0.00', 345, 15, 0, 15, 2.25),
(1071, 122, 'Embroidery Digitizing', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(1069, 122, 'Dot Chelsea Boot Size 9', 665.47, 217, '0.00', 1330.93, 434.4, 0, 2, 65.1),
(1070, 122, 'Dot Chelsea Boot Size 10', 665.47, 108.5, '0.00', 665.47, 434.4, 0, 1, 65.1),
(1068, 122, 'Dot Chelsea Boot Size 8', 665.47, 108.5, '0.00', 665.47, 434.4, 0, 1, 65.1),
(1060, 122, 'D59 Flame Retardant & Acid Resist Trouser Size 34', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(1061, 122, 'D59 Flame Retardant & Acid Resist Trouser Size 36', 277.28, 180.8375, '0.00', 1109.14, 180.8375, 0, 4, 27.125625),
(1062, 122, 'D59 Flame Retardant & Acid Resist Trouser Size 38', 277.28, 180.8375, '0.00', 1109.14, 180.8375, 0, 4, 27.125625),
(1063, 122, 'Pioneer Safety Boot Size 7', 463.65, 151.19, '0.00', 927.3, 302.38, 0, 2, 45.357),
(1064, 122, 'Pioneer Safety Boot Size 8', 463.65, 75.595, '0.00', 463.65, 302.38, 0, 1, 45.357),
(1065, 122, 'Pioneer Safety Boot Size 9', 463.65, 151.19, '0.00', 927.3, 302.38, 0, 2, 45.357),
(789, 123, 'Goggle,Pollycarbonate- Elastic Strap (Ski Style) ANTI FOG ', 115, 18.75, '0.00', 115, 75.9, 0, 1, 11.25),
(787, 123, 'Freezer Heavy Duty socks full length', 41.02, 6.6875, '0.00', 41.02, 26.75, 0, 1, 4.0125),
(788, 123, 'Safety hard Cap with cap lamp bracket - White', 33.73, 5.5, '0.00', 33.73, 22.42, 0, 1, 3.3),
(786, 123, 'Balaclava', 443.13, 72.25, '0.00', 443.13, 289.8, 0, 1, 43.35),
(785, 123, 'Wayne Egoli Black and Toffee Size 8', 338.87, 55.25, '0.00', 338.87, 221.7, 0, 1, 33.15),
(783, 123, 'Dot Chelsea Boot Size 7', 665.47, 108.5, '0.00', 665.47, 434.4, 0, 1, 65.1),
(784, 123, 'Wayne Egoli Black and Toffee Size 7', 338.87, 55.25, '0.00', 338.87, 221, 0, 1, 33.15),
(782, 123, 'D59 Flame Retardant & Acid Resist Trouser Size 32', 277.28, 271.25625, '0.00', 1663.71, 180.8375, 0, 6, 27.125625),
(781, 123, 'D59 Flame Retardant & Acid Resist Jacket Size 36', 277.28, 271.25625, '0.00', 1663.71, 180.8375, 0, 6, 27.125625),
(795, 124, 'Navy / Lime Reflective Working Jacket S - 3XL', 314.33, 51.25, '0.00', 314.33, 205, 0, 1, 30.75),
(794, 124, '2 tone hiviz golf shirt lime / navy 180g polycotton size S-3XL', 268.33, 43.75, '0.00', 268.33, 175, 0, 1, 26.25),
(793, 124, 'Navy / yellow Vented Reflective Mining Shirt S-3XL', 328.13, 53.5, '0.00', 328.13, 214, 0, 1, 32.1),
(10460, 125, 'Sebedisano Logo Front Pocket size', 26.07, 21.25, '0.00', 130.33, 17, 0, 5, 2.55),
(10459, 125, 'Logo Digitizing', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(10457, 125, 'Rebel Kontrakta Boot size 9 ', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(10458, 125, 'D59 Flame Retardant & Acid Resist Trouser Size 36', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(10456, 125, 'Rebel Kontrakta Boot size 7', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(10453, 125, 'Navy Crew neck T-shirt 160g size XXL ', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(10455, 125, 'Navy Crew neck T-shirt 160g size L', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(858, 126, 'White, Sleeve Covers 40gms,Non-Woven pack of 100', 42.93, 7, '0.00', 42.93, 28.4, 0, 1, 4.2),
(859, 126, 'PE Apron white  pack of 100', 121.13, 19.75, '0.00', 121.13, 79.8, 0, 1, 11.85),
(860, 126, 'Blue Apron ,25gms,Non Woven Pack of 100', 47.53, 7.75, '0.00', 47.53, 31.7, 0, 1, 4.65),
(857, 126, 'White Beard Covers,25gms,Non-Woven Pack of 100', 64.4, 10.5, '0.00', 64.4, 42.2, 0, 1, 6.3),
(852, 126, 'Mop Cap  All Colours MOQ 1000 (Carton)', 39.87, 65, '0.00', 398.67, 26, 0, 10, 3.9),
(856, 126, ' Clear Deli Glove pack f 100', 18.4, 3, '0.00', 18.4, 12.37, 0, 1, 1.8),
(855, 126, ' Clear Deli Glove MOQ 1000 (Carton)', 15.33, 25, '0.00', 153.33, 10, 0, 10, 1.5),
(854, 126, 'White Shoe covers,40gms, Polypropylene Pack of 100', 81.27, 13.25, '0.00', 81.27, 53.9, 0, 1, 7.95),
(853, 126, 'Mop Cap  All Colours Per pack of 100', 42.93, 7, '0.00', 42.93, 28.6, 0, 1, 4.2),
(1067, 122, 'Dot Chelsea Boot Size 7', 666.08, 217.2, '0.00', 1332.16, 434.4, 0, 2, 65.16),
(1066, 122, 'Pioneer Safety Boot Size 10', 463.65, 75.595, '0.00', 463.65, 302.38, 0, 1, 45.357),
(1058, 122, 'D59 Flame Retardant & Acid Resist Jacket Size 42', 277.28, 180.8375, '0.00', 1109.14, 180.8375, 0, 4, 27.125625),
(1059, 122, 'D59 Flame Retardant & Acid Resist Trouser Size 32', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(10996, 127, ' 80/20  Conti Suit Navy with reflective size 30-44', 203.93, 498.75, '0.00', 3059, 133.3, 0, 15, 19.95),
(10995, 127, 'Polycotton Conti suits Navy with reflective tape Size 30-44', 191.67, 468.75, '0.00', 2875, 125, 0, 15, 18.75),
(935, 128, 'Wayne Gripper gumboot STC Size 10', 251.47, 41, '0.00', 251.47, 164.4, 0, 1, 24.6),
(934, 128, 'Wayne Gripper gumboot STC Size 7', 251.47, 123, '0.00', 754.4, 164.4, 0, 3, 24.6),
(931, 128, 'Bova Maverick boot size 9', 771.11, 125.725, '0.00', 771.11, 502.9, 0, 1, 75.435),
(932, 128, 'Bova Maverick boot size 10', 771.11, 125.725, '0.00', 771.11, 502.9, 0, 1, 75.435),
(933, 128, 'Dot Ella Lilly Size 5', 688.16, 112.2, '0.00', 688.16, 448.8, 0, 1, 67.32),
(930, 128, 'Bova Maverick boot size 8', 771.11, 251.45, '0.00', 1542.23, 502.9, 0, 2, 75.435),
(929, 128, 'Bova Maverick boot size 7', 771.11, 754.35, '0.00', 4626.68, 502.9, 0, 6, 75.435),
(928, 128, 'Bova Maverick boot size 5', 771.11, 125.725, '0.00', 771.11, 502.9, 0, 1, 75.435),
(936, 128, 'Wayne Gripper gumboot STC Size 12', 251.47, 41, '0.00', 251.47, 164.4, 0, 1, 24.6),
(10454, 125, 'Navy Crew neck T-shirt 160g size M', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(10451, 125, 'Royal Blue Boiler Suit Polycotton with reflective size 44', 199.33, 32.5, '0.00', 199.33, 130, 0, 1, 19.5),
(985, 129, 'Cap Lamp Belt Padded & Shoulder Straps ', 590.33, 96.25, '0.00', 590.33, 385, 0, 1, 57.75),
(984, 129, 'Spectacle SPORT Style Clear', 14.9, 2.428875, '0.00', 14.9, 9.7155, 0, 1, 1.457325),
(983, 129, 'Rebel Kontrakta Boot size 7', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(982, 129, 'Freezer Heavy Duty socks full length', 41.02, 20.0625, '0.00', 123.05, 26.75, 0, 3, 4.0125),
(981, 129, 'D59 Flame Retardant & Acid Resist Trouser Size 30', 277.28, 135.628125, '0.00', 831.85, 180.8375, 0, 3, 27.125625),
(980, 129, 'D59 Flame Retardant & Acid Resist Jacket Size 34', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(979, 129, 'Navy / Orange Vented Reflecticve Mining Shirt M', 328.13, 107, '0.00', 656.27, 214, 0, 2, 32.1),
(986, 129, 'Cut Resistatnd Glove Level 5', 58.45, 9.530625, '0.00', 58.45, 38.1225, 0, 1, 5.718375),
(1057, 122, 'D59 Flame Retardant & Acid Resist Jacket Size 40', 277.28, 180.8375, '0.00', 1109.14, 180.8375, 0, 4, 27.125625),
(1056, 122, 'D59 Flame Retardant & Acid Resist Jacket Size 38', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(1055, 122, 'D59 Flame Retardant & Acid Resist Jacket Size 34', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(1079, 122, 'Horizon Shirts Short Sleeve Tripple Stitched XL', 395.6, 64.5, '0.00', 395.6, 258.9, 0, 1, 38.7),
(1085, 130, 'Dromex Trousers Sasol Spec, Navy Acid/Flame SABS Size 28-44', 354.2, 57.75, '0.00', 354.2, 231.2, 0, 1, 34.65),
(1084, 130, 'Dromex Jacket Sasol Spec, Navy Acid/Flame SABS 32-44', 354.2, 57.75, '0.00', 354.2, 231.2, 0, 1, 34.65),
(10452, 125, 'Navy Crew neck T-shirt 160g size XL ', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(10449, 125, 'Rebel Kontrakta Boot size 8', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(1311, 131, 'Logo on Jackets and T-shirts- Embroidery', 21.47, 2898, '0.00', 17774.4, 14, 0, 828, 2.1),
(1309, 131, 'Silver Reflective Tape on Golf T-Shirts', 72.07, 6345, '0.00', 38916, 47.95, 0, 540, 7.05),
(1310, 131, 'Logo Digitizing', 230, 20250, '0.00', 124200, 150, 0, 540, 22.5),
(1307, 131, 'D59 Flame Retardant & Acid Resist Trouser Size 42', 277.28, 361.675, '0.00', 2218.27, 180.8375, 0, 8, 27.125625),
(1308, 131, 'D59 Flame Retardant & Acid Resist Trouser Size 44', 277.28, 180.8375, '0.00', 1109.14, 180.8375, 0, 4, 27.125625),
(1306, 131, 'D59 Flame Retardant & Acid Resist Trouser Size 40', 277.28, 904.1875, '0.00', 5545.68, 180.8375, 0, 20, 27.125625),
(1305, 131, 'D59 Flame Retardant & Acid Resist Trouser Size 34', 277.28, 7866.43125, '0.00', 48247.45, 180.8375, 0, 174, 27.125625),
(1304, 131, 'D59 Flame Retardant & Acid Resist Trouser Size 32', 277.28, 3978.425, '0.00', 24401.01, 180.8375, 0, 88, 27.125625),
(1303, 131, 'D59 Flame Retardant & Acid Resist Trouser Size 30', 277.28, 1265.8625, '0.00', 7763.96, 180.8375, 0, 28, 27.125625),
(1302, 131, 'D59 Flame Retardant & Acid Resist Trouser Size 28', 277.28, 632.93125, '0.00', 3881.98, 180.8375, 0, 14, 27.125625),
(1301, 131, 'D59 Flame Retardant & Acid Resist Jacket Size 50', 335.74, 109.48, '0.00', 671.48, 218.96, 0, 2, 32.844),
(1300, 131, 'D59 Flame Retardant & Acid Resist Jacket Size 48', 319.25, 728.72625, '0.00', 4469.52, 208.2075, 0, 14, 31.231125),
(1299, 131, 'D59 Flame Retardant & Acid Resist Jacket Size 46', 304.26, 892.94625, '0.00', 5476.74, 198.4325, 0, 18, 29.764875),
(1298, 131, 'D59 Flame Retardant & Acid Resist Jacket Size 44', 277.28, 1989.2125, '0.00', 12200.5, 180.8375, 0, 44, 27.125625),
(1297, 131, 'D59 Flame Retardant & Acid Resist Jacket Size 40', 277.28, 1989.2125, '0.00', 12200.5, 180.8375, 0, 44, 27.125625),
(1292, 131, 'Golf shirt navy polycotton size XL', 111.93, 401.5, '0.00', 2462.53, 73, 0, 22, 10.95),
(1293, 131, 'Golf shirt navy polycotton size XXL', 111.93, 219, '0.00', 1343.2, 73, 0, 12, 10.95),
(1294, 131, 'Golf shirt navy polycotton size XXXL', 111.93, 36.5, '0.00', 223.87, 73, 0, 2, 10.95),
(1295, 131, 'D59 Flame Retardant & Acid Resist Jacket Size 36', 277.28, 1265.8625, '0.00', 7763.96, 180.8375, 0, 28, 27.125625),
(1296, 131, 'D59 Flame Retardant & Acid Resist Jacket Size 38', 277.28, 6238.89375, '0.00', 38265.22, 180.8375, 0, 138, 27.125625),
(1290, 131, 'Golf shirt navy polycotton size M', 111.93, 3248.5, '0.00', 19924.13, 73, 0, 178, 10.95),
(1291, 131, 'Golf shirt navy polycotton size L', 111.93, 1606, '0.00', 9850.13, 73, 0, 88, 10.95),
(1289, 131, 'Golf shirt navy polycotton size S', 111.93, 4307, '0.00', 26416.27, 73, 0, 236, 10.95),
(1318, 132, 'White Shoe Covers,40gms, Polypropylene pack of100\'s', 81.27, 13.25, '0.00', 81.27, 53.9, 0, 1, 7.95),
(1319, 132, 'Blue /White disposable coverall (Non Woven) 40GSM  with zip & hood S-3XL MOQ 50', 32.2, 262.5, '0.00', 1610, 21.3, 0, 50, 3.15),
(1464, 133, 'Clear Face cover for Hard Hat  (Clip On)', 47.53, 7.75, '0.00', 47.53, 31.5, 0, 1, 4.65),
(1463, 133, 'Safety Hard Cap White', 20.92, 3.410625, '0.00', 20.92, 13.6425, 0, 1, 2.046375),
(1461, 133, 'Single lanyard full body harness with snap hook', 426.27, 69.5, '0.00', 426.27, 278, 0, 1, 41.7),
(1462, 133, 'Double lanyard full body harness with scaffold hook', 590.33, 96.25, '0.00', 590.33, 385, 0, 1, 57.75),
(1460, 133, 'Spectacle EURO Clear adjustable Frame', 15.82, 2.57975, '0.00', 15.82, 10.319, 0, 1, 1.54785),
(1459, 133, 'Spectacle (Wrap Around) Clear', 19.16, 37.485, '0.00', 229.91, 12.495, 0, 12, 1.87425),
(1458, 133, 'Conti suits Royal Blue size 28-44', 148.38, 24.193125, '0.00', 148.38, 96.7725, 0, 1, 14.515875),
(1457, 133, 'Rebel Kontrakta Boot size 3-14', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(1456, 133, 'ROKO CHUKKA Boots Size 3 -12', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(1455, 133, 'Cut Resistatnd Glove Level 5', 53.67, 8.75, '0.00', 53.67, 35, 0, 1, 5.25),
(1454, 133, 'ROKO CHUKKA Boots Size 3 -12', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(1453, 133, 'Cut Resistatnd Glove Level 5', 58.45, 9.530625, '0.00', 58.45, 38.1225, 0, 1, 5.718375),
(1452, 133, 'Face Shield clear complete', 73.6, 12, '0.00', 73.6, 48, 0, 1, 7.2),
(1465, 133, ' Notch ERGO Steel Climbers (Spikes)', 11719.27, 1910.75, '0.00', 11719.27, 7643.48, 0, 1, 1146.45),
(1660, 134, 'Boot - Crazy Horse Black - Size 11', 2200.33, 358.75, '0.00', 2200.33, 1435, 0, 1, 215.25),
(1659, 134, 'Boot - Ladies Rugged Black - Size 5', 1663.21, 271.175, '0.00', 1663.21, 1084.7, 0, 1, 162.705),
(1658, 134, 'Boot - Thuli - Chelsea Ladies - Size 5', 1351.33, 220.325, '0.00', 1351.33, 881.3, 0, 1, 132.195),
(1656, 134, 'Shoe - Iman - Ladies - Size 5', 1022.12, 166.65, '0.00', 1022.12, 666.6, 0, 1, 99.99),
(1657, 134, 'Boot - Nala - Ladies - Size 5', 1178.06, 192.075, '0.00', 1178.06, 768.3, 0, 1, 115.245),
(1519, 137, 'Logo on T shirts Front Pocket size', 23, 3.75, '0.00', 23, 15, 0, 1, 2.25),
(1518, 137, 'Logo Digitizing', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(1517, 137, 'Bump Cap Navy', 104.65, 17.0625, '0.00', 104.65, 68.25, 0, 1, 10.2375),
(1516, 137, '6 PANEL BASEBALL CAP NAVY BLUE', 36.8, 6, '0.00', 36.8, 24, 0, 1, 3.6),
(1515, 137, ' Lime hiviz golf shirt 140g Micromesh size S-3XL', 151.8, 24.75, '0.00', 151.8, 99, 0, 1, 14.85),
(1514, 137, 'Lime screw neck T-shirt 160g  size S -3XL', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(1513, 137, 'Conti suits Royal Blue with Reflective tape size 28-44', 191.67, 31.25, '0.00', 191.67, 125, 0, 1, 18.75),
(1512, 137, 'D59 Flame Retardant & Acid Resist Trouser Size 28-44', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(1520, 137, 'Logo on Caps front', 23, 3.75, '0.00', 23, 15, 0, 1, 2.25),
(1655, 134, 'Shoe - Ladies Light Industrial - Size 8', 1507.27, 245.75, '0.00', 1507.27, 983, 0, 1, 147.45),
(1654, 134, 'Shoe - Ladies Light Industrial - Size 7', 1507.27, 245.75, '0.00', 1507.27, 983, 0, 1, 147.45),
(1652, 134, 'Shoe - Ladies Light Industrial - Size 5', 1507.27, 245.75, '0.00', 1507.27, 983, 0, 1, 147.45),
(1653, 134, 'Shoe - Ladies Light Industrial - Size 6', 1507.27, 245.75, '0.00', 1507.27, 983, 0, 1, 147.45),
(1651, 134, 'Shoe - Kito - Ladies Slip-on - 8', 900.07, 146.75, '0.00', 900.07, 587, 0, 1, 88.05),
(1648, 134, 'Rebel Shoe - Zari - Ladies Velcro Strap - Size 4', 952.94, 155.37, '0.00', 952.94, 621.48, 0, 1, 93.222),
(1649, 134, 'Rebel Shoe - Zari - Ladies Velcro Strap - Size 7', 952.94, 155.37, '0.00', 952.94, 621.48, 0, 1, 93.222),
(1650, 134, 'Shoe - Kito - Ladies Slip-on - 6', 900.07, 146.75, '0.00', 900.07, 587, 0, 1, 88.05),
(1647, 134, 'Rebel Shoe - Zari - Ladies Velcro Strap - Size 3', 952.94, 155.37, '0.00', 952.94, 621.48, 0, 1, 93.222),
(1645, 134, 'Conti suits Royal Blue size 38', 148.38, 24.193125, '0.00', 148.38, 96.7725, 0, 1, 14.515875),
(1646, 134, 'Rebel Shoe - Zari - Ladies Velcro Strap - Size 2', 952.94, 155.37, '0.00', 952.94, 621.48, 0, 1, 93.222),
(1644, 134, 'Lemaitre Clog Slip on She STC Size 9', 763.6, 124.5, '0.00', 763.6, 498, 0, 1, 74.7),
(1643, 134, 'Bova Multi safety shoe size 10', 639.4, 104.25, '0.00', 639.4, 417, 0, 1, 62.55),
(1642, 134, 'Bova Multi safety shoe size 9', 639.4, 312.75, '0.00', 1918.2, 417, 0, 3, 62.55),
(1640, 134, 'Bova Multi safety shoe size 7', 639.4, 1146.75, '0.00', 7033.4, 417, 0, 11, 62.55),
(1641, 134, 'Bova Multi safety shoe size 8', 639.4, 729.75, '0.00', 4475.8, 417, 0, 7, 62.55),
(1639, 134, 'Bova Multi safety shoe size 6', 639.4, 417, '0.00', 2557.6, 417, 0, 4, 62.55),
(2347, 138, 'Navy  Crew neck T-shirt 160g  size XXL', 75.133333333333, 117.5, '5.00', 746.33, 49, 0, 10, 7.35),
(2346, 138, 'Navy  Crew neck T-shirt 160g  size XL', 75.133333333333, 44, '5.00', 295.53, 49, 0, 4, 7.35),
(2345, 138, 'Navy  Crew neck T-shirt 160g  size L', 75.133333333333, 93, '5.00', 596.07, 49, 0, 8, 7.35),
(2344, 138, 'Navy  Crew neck T-shirt 160g  size M', 75.133333333333, 117.5, '5.00', 746.33, 49, 0, 10, 7.35),
(2343, 138, 'Bova Boot - Adapt Size 10', 663.78, 429.12, '3.78', 2651.34, 432.9, 0, 4, 64.935),
(2342, 138, 'Bova Boot - Adapt Size 9', 663.78, 212.67, '3.78', 1323.78, 432.9, 0, 2, 64.935),
(2341, 138, 'Bova Boot - Adapt Size 8', 663.78, 429.12, '3.78', 2651.34, 432.9, 0, 4, 64.935),
(2340, 138, 'Bova Boot - Adapt Size 7', 663.78, 104.445, '3.78', 660, 432.9, 0, 1, 64.935),
(2339, 138, 'Bova Boot - Adapt Size 6', 663.78, 104.445, '3.78', 660, 432.9, 0, 1, 64.935),
(2338, 138, 'AUSTRA CHELSEA Boots Black Size 10', 498.33333333333, 73.25, '8.00', 490.33, 325, 0, 1, 48.75),
(2337, 138, 'AUSTRA CHELSEA Boots Black Size 7', 498.33333333333, 154.5, '8.00', 988.67, 325, 0, 2, 48.75),
(2336, 138, 'Dromex Trousers Sasol Spec,Navy Acid/Flame, SABS Size  46', 389.988, 97.17, '30.00', 749.98, 254.34, 0, 2, 38.151),
(2335, 138, 'Dromex Trousers Sasol Spec,Navy Acid/Flame, SABS Size  44', 354.50666666667, 227.2, '4.00', 1414.03, 231.2, 0, 4, 34.68),
(2334, 138, 'Dromex Trousers Sasol Spec,Navy Acid/Flame, SABS Size 42', 354.50666666667, 342.8, '4.00', 2123.04, 231.2, 0, 6, 34.68),
(2333, 138, 'Dromex Trousers Sasol Spec,Navy Acid/Flame, SABS Size 40', 354.50666666667, 227.2, '4.00', 1414.03, 231.2, 0, 4, 34.68),
(2332, 138, 'Dromex Trousers Sasol Spec,Navy Acid/Flame, SABS Size 38', 354.50666666667, 342.8, '4.00', 2123.04, 231.2, 0, 6, 34.68),
(2331, 138, 'Dromex Trousers Sasol Spec,Navy Acid/Flame, SABS Size 36', 354.50666666667, 458.4, '4.00', 2832.05, 231.2, 0, 8, 34.68),
(2330, 138, 'Dromex Trousers Sasol Spec,Navy Acid/Flame, SABS Size 32', 354.50666666667, 113.6, '2.0', 707.01, 231.2, 0, 2, 34.68),
(2329, 138, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, SABS Size 50', 425.408, 68.72, '70', 780.82, 277.44, 0, 2, 41.616),
(2328, 138, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, SABS Size 48', 407.68266666667, 215.88, '50.00', 1580.73, 265.88, 0, 4, 39.882),
(2327, 138, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, SABS Size 46', 389.988, 351.51, '30.00', 2309.93, 254.34, 0, 6, 38.151),
(2326, 138, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, SABS Size 44', 354.50666666667, 227.2, '4.00', 1414.03, 231.2, 0, 4, 34.68),
(2325, 138, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, SABS Size 42', 354.50666666667, 342.8, '4.00', 2123.04, 231.2, 0, 6, 34.68),
(2323, 138, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, SABS Size 36', 354.50666666667, 111.6, '4.00', 705.01, 231.2, 0, 2, 34.68),
(2324, 138, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, SABS Size 40', 354.50666666667, 458.4, '4.00', 2832.05, 231.2, 0, 8, 34.68),
(1892, 140, 'Dromex Earplug ,Blue Mushroom Tri-Flange Corded (SNR 29)', 4.14, 67.5, '0.00', 414, 2.7, 0, 100, 0.405),
(1882, 139, 'Logo Digitizing', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(1884, 139, 'Names Embroided', 21.466666666667, 31.5, '0.00', 193.2, 14, 0, 9, 2.1),
(1883, 139, 'Logo in front Pocket size', 26.066666666667, 38.25, '0.00', 234.6, 17, 0, 9, 2.55),
(1881, 139, 'Rebel Kontrakta Boot size 10', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(1880, 139, 'Safety hard Cap with cap lamp bracket - Yellow', 31.310666666667, 15.315, '0.00', 93.93, 20.42, 0, 3, 3.063),
(1879, 139, 'Cap Lamp Belt Padded &  Shoulder Straps ', 590.33333333333, 288.75, '0.00', 1771, 385, 0, 3, 57.75),
(1877, 139, 'D59 Flame Retardant & Acid Resist Jacket Size 40', 277.28416666667, 135.628125, '0.00', 831.85, 180.8375, 0, 3, 27.125625),
(1878, 139, 'D59 Flame Retardant & Acid Resist Trouser Size 36', 277.28416666667, 135.628125, '0.00', 831.85, 180.8375, 0, 3, 27.125625),
(1874, 139, 'Royal Blue Boiler Suit Polycotton with Reflectors size 52 ', 322, 157.5, '0.00', 966, 210, 0, 3, 31.5),
(1875, 139, 'Wayne Gipper Heavy duty BLK/BLK K STC  Size 9', 252.08, 41.1, '0.00', 252.08, 164.4, 0, 1, 24.66),
(1876, 139, 'Wayne Gipper Heavy duty BLK/BLK K STC  Size 11', 252.08, 41.1, '0.00', 252.08, 164.4, 0, 1, 24.66),
(1873, 139, 'Royal Blue Boiler Suit Polycotton with Reflectors size 50', 300.53333333333, 147, '0.00', 901.6, 196, 0, 3, 29.4),
(1872, 139, 'Cut Resistatnd Glove Level 5', 53.666666666667, 26.25, '0.00', 161, 35, 0, 3, 5.25),
(1869, 139, 'Spectacle SPORT Style Clear', 14.8971, 7.286625, '0.00', 44.69, 9.7155, 0, 3, 1.457325),
(1871, 139, 'Ear Plug Tri Flange, Reusable', 4.301, 70.125, '0.00', 430.1, 2.805, 0, 100, 0.42075),
(1870, 139, 'Freezer Heavy Duty socks full length', 41.016666666667, 60.1875, '0.00', 369.15, 26.75, 0, 9, 4.0125),
(1891, 140, '450gms,Blood & Fat,110 x 70,White', 113.46666666667, 92.5, '0.00', 567.33, 74, 0, 5, 11.1),
(1890, 140, 'Crayfish Glove', 16.1, 315, '0.00', 1932, 10.5, 0, 120, 1.575),
(1889, 140, 'FFP2 Dust Mask SABS Approved', 3.68, 36, '0.00', 220.8, 2.4, 0, 60, 0.36),
(1900, 141, 'Barron Shaft Safety Shirt Long Sleeve Navy/Yellow  Size L', 659.318, 2472.4425, '0.00', 15164.31, 429.99, 0, 23, 64.4985),
(1899, 141, 'Navy / yellow Vented Reflective Mining Shirt Size L', 328.13333333333, 1230.5, '0.00', 7547.07, 214, 0, 23, 32.1),
(1906, 143, '1.1kW 6P 525/550V B35 L90L IE3 MOTOR WEG W22 IP66 CI', 10909.82, 1778.775, '0.00', 10909.82, 7115.1, 0, 1, 1067.265),
(1905, 143, '200kW 4P 525/550V B35 315SM IE3 MOTOR WEG W22 IP66 CI', 292866.66666667, 47750, '0.00', 292866.67, 191000, 0, 1, 28650),
(6896, 144, 'PVC Red Glove Open Cuff 40cm', 21, 4930.434, '0.0', 30240, 13.69565, 0, 1440, 2.0543475),
(1930, 145, 'Your Safety Is our priority Embroided', 27.6, 216, '0.00', 1324.8, 18, 0, 48, 2.7),
(1928, 145, 'Names Embroided', 21.466666666667, 168, '0.00', 1030.4, 14, 0, 48, 2.1),
(1929, 145, 'Trencon Logo at the Back Embroided', 53.666666666667, 420, '0.00', 2576, 35, 0, 48, 5.25),
(1927, 145, 'Navy / yellow Vented Reflective Mining Shirt S-3XL', 328.1333333333333, 2568, '0.00', 15750.4, 214, 0, 48, 32.1),
(1942, 146, 'BRT Pace Sock', 88.918, 14.4975, '0.00', 88.92, 57.99, 0, 1, 8.6985),
(1940, 146, 'BRT429 BRT Pitch Soccer Single Set Size XS-3XL', 269.85133333333, 43.9975, '0.00', 269.85, 175.99, 0, 1, 26.3985),
(1941, 146, 'BRT397 BRT Blade Soccer Single Set', 306.65133333333, 49.9975, '0.00', 306.65, 199.99, 0, 1, 29.9985),
(5807, 142, 'ABEK1 Cartridge 6059 ( Comes in a ack of 2) Price per per 1			', 242.72666666667, 316.6, '0.00', 1941.81, 158.3, 0, 8, 23.745),
(5806, 142, '3M 6300 Half Face Mask			', 358.64666666667, 233.9, '0.00', 1434.59, 233.9, 0, 4, 35.085),
(5805, 142, 'P2 Cartridges (Dust Cartridge)', 55.506666666667, 181, '0.00', 1110.13, 36.2, 0, 20, 5.43),
(2210, 147, 'Optoma ZH400    4000 LUMEN  ', 45998.466666667, 7499.75, '0.00', 45998.47, 29999, 0, 1, 4499.85),
(2209, 147, 'Optoma ZW350   4500 LUMEN ', 38331.8, 6249.75, '0.00', 38331.8, 24999, 0, 1, 3749.85),
(2447, 148, 'Bova Chelsea Size 11', 1341.2066666667, 218.675, '0.00', 1341.21, 874.7, 0, 1, 131.205),
(2445, 148, 'D59 Flame Retardant & Acid Resist Trouser Size 40', 283.66666666667, 92.5, '0.00', 567.33, 185, 0, 2, 27.75),
(2446, 148, 'AUSTRA CHELSEA Boots Black Size 11', 498.33333333333, 81.25, '0.00', 498.33, 325, 0, 1, 48.75),
(2444, 148, 'D59 Flame Retardant & Acid Resist Jacket Size 42', 283.66666666667, 92.5, '0.00', 567.33, 185, 0, 2, 27.75),
(2443, 148, 'Dot Boot - Chelsea - 9002 Size 11', 666.08, 108.6, '0.00', 666.08, 434.4, 0, 1, 65.16),
(2442, 148, 'Trousers Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS Size 40', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2441, 148, 'Jacket Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS Size 42', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2297, 149, 'Bova Chelsea Boot Size 11', 1341.2066666667, 218.675, '0.00', 1341.21, 874.7, 0, 1, 131.205),
(2294, 149, 'Bova Chelsea Boot Size 7', 1341.2066666667, 437.35, '0.00', 2682.41, 874.7, 0, 2, 131.205),
(2295, 149, 'Bova Chelsea Boot Size 9', 1341.2066666667, 656.025, '0.00', 4023.62, 874.7, 0, 3, 131.205),
(2296, 149, 'Bova Chelsea Boot Size 10', 1341.2066666667, 218.675, '0.00', 1341.21, 874.7, 0, 1, 131.205),
(2293, 149, 'Dromex Jacket Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS Size 44', 352.51333333333, 57.475, '0.00', 352.51, 229.9, 0, 1, 34.485),
(2292, 149, 'Dromex Jacket Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS SIze 42', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2291, 149, 'Dromex Jacket Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS Size 38', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2290, 149, 'Dromex Jacket Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS Size 36', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2287, 149, 'Dromex Trousers Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS SIze 34', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2289, 149, 'Dromex Trousers Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS SIze 40', 352.51333333333, 57.475, '0.00', 352.51, 229.9, 0, 1, 34.485),
(2288, 149, 'Dromex Trousers Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS SIze 38', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2286, 149, 'Dromex Trousers Sasol Spec,Navy Acid/Flame,50mm Reflective Tape,SABS SIze 32', 352.51333333333, 114.95, '0.00', 705.03, 229.9, 0, 2, 34.485),
(2363, 150, 'Dromex Ear Plug Tri Flange, Reusable', 4.14, 67.36, '0.14', 413.86, 2.7, 0, 100, 0.405),
(2362, 150, 'Lime Reflective Vest with Zip & ID Size L', 46.92, 15.3, '0.00', 93.84, 30.6, 0, 2, 4.59),
(2361, 150, 'Miners Cap Lamp Belt Adjustable to Size', 140.60666666667, 137.55, '0.00', 843.64, 91.7, 0, 6, 13.755),
(2360, 150, 'Wayne Gripper Gumboot STC Size 12', 252.08, 80.12, '2.08', 502.08, 164.4, 0, 2, 24.66),
(2359, 150, 'Wayne Gripper Gumboot STC Size 11', 252.08, 80.12, '2.08', 502.08, 164.4, 0, 2, 24.66),
(2358, 150, 'Wayne Gripper Gumboot STC Size 10', 252.08, 80.12, '2.08', 502.08, 164.4, 0, 2, 24.66),
(2357, 150, 'Wayne Gripper Gumboot STC Size 9', 252.08, 80.12, '2.08', 502.08, 164.4, 0, 2, 24.66),
(2356, 150, 'Wayne Gripper Gumboot STC Size 7', 252.08, 80.12, '2.08', 502.08, 164.4, 0, 2, 24.66),
(2372, 151, 'Dromex Pants Sasol Spec,Navy Acid/Flame, All Sizes', 310.00166666667, 50.54375, '0.00', 310, 202.175, 0, 1, 30.32625),
(2371, 151, 'Dromex Jacket Sasol Spec,Navy Acid/Flame, All Sizes', 310.00166666667, 50.54375, '0.00', 310, 202.175, 0, 1, 30.32625),
(2412, 152, 'Black disinfectant 5ltr.', 117.3, 19.125, '0.00', 117.3, 76.5, 0, 1, 11.475),
(2410, 152, 'Citronol Hand Cleaner with grit 30 Kg', 810.014, 132.0675, '0.00', 810.01, 528.27, 0, 1, 79.2405),
(2407, 152, 'Virgin toilet paper 1ply 48\'s', 220.8, 36, '0.00', 220.8, 144, 0, 1, 21.6),
(2411, 152, 'Safety Hard Cap Blue', 24.533333333333, 20, '0.00', 122.67, 16, 0, 5, 2.4),
(2409, 152, 'Varta Industrial AA 10 Pack ', 107.33333333333, 35, '0.00', 214.67, 70, 0, 2, 10.5),
(2408, 152, 'FFP2 Dust Mask SABS Approved', 3.68, 180, '0.00', 1104, 2.4, 0, 300, 0.36),
(2416, 153, 'Condere Z19 Standing Fan A 400 mm 3 Blade Floor Fan  Blue grey white', 429.3333333333333, 70, '0.00', 429.33, 280, 0, 1, 42),
(2415, 153, 'Condere 20\'\' Floor Fan A+++ 22 mm 5 Blade Floor Fan (Black, Pack of 1)', 565.6466666666665, 92.22500000000002, '0.00', 565.65, 368.9, 0, 1, 55.334999999999994),
(2440, 154, '80/20 Conti suits White size 28-44', 224.32666666667, 36.575, '0.00', 224.33, 146.3, 0, 1, 21.945),
(2439, 154, '80/20 Conti suits Red size 28-44', 196.26666666667, 32, '0.00', 196.27, 128, 0, 1, 19.2),
(2436, 154, 'Mop Cap  All Colours/ MOQ 1 Pack of 100', 43.853333333333, 7.15, '0.00', 43.85, 28.6, 0, 1, 4.29),
(2437, 154, 'Mop Cap  All Colours MOQ 1000/1 Carton', 39.866666666667, 65, '0.00', 398.67, 26, 0, 10, 3.9),
(2438, 154, '80/20 Conti suits Navy Blue size 28-44', 196.26666666667, 32, '0.00', 196.27, 128, 0, 1, 19.2),
(2435, 154, 'White/ Red sole Gumboots Size 3-12', 222.33333333333, 36.25, '0.00', 222.33, 145, 0, 1, 21.75),
(2453, 155, 'Industrial Pedestal Fan 650mm  220V  160W  1400rpm  11700m3/hr', 2605.3633333333, 424.7875, '0.00', 2605.36, 1699.15, 0, 1, 254.8725),
(2452, 155, 'Industrial Wall Mounted  450mm  220V  90W  1400rmp  5040m3/hr', 1823.3633333333, 297.2875, '0.00', 1823.36, 1189.15, 0, 1, 178.3725),
(2451, 155, 'Industrial Floor Fan 500mm  220V  150W  1400rmp  5760m3/hr', 1823.3633333333, 297.2875, '0.00', 1823.36, 1189.15, 0, 1, 178.3725),
(5764, 156, 'Safety Boots Size 3 -12', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(5763, 156, 'Lime Reflective Vest with Zip & ID S-4XL', 37.566666666667, 6.125, '0.00', 37.57, 24.5, 0, 1, 3.675),
(5762, 156, 'PVC Rubberised Rain Suit Navy S- 3XL', 147.2, 24, '0.00', 147.2, 96, 0, 1, 14.4),
(5761, 156, '80/20 Conti suits Navy Blue/Red/White/Grey/Black size 28-44', 196.26666666667, 32, '0.00', 196.27, 128, 0, 1, 19.2),
(5760, 156, 'Red heat resistant apron palm welding glove MOQ 12', 102.73333333333, 201, '0.00', 1232.8, 67, 0, 12, 10.05),
(5759, 156, 'Double Elastic 21\'\' Mop Caps Red/100', 35.266666666667, 5.75, '0.00', 35.27, 23, 0, 1, 3.45),
(5758, 156, 'Double Elastic 21\'\' Mop Caps White/100', 35.266666666667, 5.75, '0.00', 35.27, 23, 0, 1, 3.45),
(5757, 156, 'Double Elastic 21\'\' Mop Caps Yellow/100', 35.266666666667, 5.75, '0.00', 35.27, 23, 0, 1, 3.45),
(5756, 156, 'Double Elastic 21\'\'  Mop Caps Green/100', 35.266666666667, 5.75, '0.00', 35.27, 23, 0, 1, 3.45),
(5755, 156, 'Beard Cover White /100', 56.733333333333, 9.25, '0.00', 56.73, 37, 0, 1, 5.55),
(5754, 156, 'KN95 Mask/ 20', 2.4533333333333, 8, '0.00', 49.07, 1.6, 0, 20, 0.24),
(5752, 156, 'Green PVC Apron Heavy Duty ', 35.266666666667, 5.75, '0.00', 35.27, 23, 0, 1, 3.45),
(5753, 156, 'Yellow PVC Apron Heavy Duty ', 35.266666666667, 5.75, '0.00', 35.27, 23, 0, 1, 3.45),
(2546, 157, 'Bova Neoflex  Boot Size 3-15', 766.66666666667, 6500, '0.00', 39866.67, 500, 0, 52, 75),
(6916, 158, 'Varta Industrial AA 10 Pack ', 107.33, 17.5, '0.00', 107.33, 70, 0, 1, 10.5),
(3807, 159, 'M30 HDG FLT WASHERS DIN126 ', 4.2933333333333, 0.7, '0.00', 4.29, 2.8, 0, 1, 0.42),
(3913, 160, 'M8 HDG FLT WASHERS DIN126 ', 0.15333333333333, 0.025, '0.00', 0.15, 0.1, 0, 1, 0.015),
(6915, 158, 'Knee Welding Spats', 108.41, 88.375, '0.00', 542.03, 70.7, 0, 5, 10.605),
(6913, 158, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 179.4, 117, '0.00', 717.6, 117, 0, 4, 17.55),
(6914, 158, 'Blue Lined Welding Gloves Elbow', 83.72, 163.8, '0.00', 1004.64, 54.6, 0, 12, 8.19),
(3806, 159, 'M30 X 1 GR8.8 BLK THREADED ROD ', 495.972, 4.2, '0.00', 495.97, 323.46, 0, 1, 2.52),
(3805, 159, 'M30 X 90 HT BOLT HDG ', 107.88533333333, 17.59, '0.00', 107.89, 70.36, 0, 1, 10.554),
(3804, 159, 'M27 HDG FLT WASHERS DIN126', 3.0206666666667, 0.4925, '0.00', 3.02, 1.97, 0, 1, 0.2955),
(3803, 159, 'M27 X 1 GR8.8 GALV THREADED ROD ', 508.668, 82.935, '0.00', 508.67, 331.74, 0, 1, 49.761),
(3801, 159, 'M27 HDG HEX NUTS', 22.386666666667, 3.65, '0.00', 22.39, 14.6, 0, 1, 2.19),
(3802, 159, 'M27 X 1 GR8.8 BLK THREADED ROD ', 452.732, 73.815, '0.00', 452.73, 295.26, 0, 1, 44.289),
(3800, 159, 'M24 HDG FLT WASHERS DIN126 ', 2.3153333333333, 0.3775, '0.00', 2.32, 1.51, 0, 1, 0.2265),
(3799, 159, 'M24 X 1 GR8.8 GALV THREADED ROD ', 341.16666666667, 55.625, '0.00', 341.17, 222.5, 0, 1, 33.375),
(3797, 159, 'M24 HDG HEX NUTS', 10.273333333333, 1.675, '0.00', 10.27, 6.7, 0, 1, 1.005),
(3798, 159, 'M24 X 1 GR8.8 BLK THREADED ROD', 298.18733333333, 48.6175, '0.00', 298.19, 194.47, 0, 1, 29.1705),
(3796, 159, 'M24 X 80 HT BOLT HDG', 38.946666666667, 6.35, '0.00', 38.95, 25.4, 0, 1, 3.81),
(3795, 159, 'M20 HDG FLT WASHERS DIN126', 1.3493333333333, 0.22, '0.00', 1.35, 0.88, 0, 1, 0.132),
(3794, 159, 'M20 X 1 GR8.8 GALV THREADED ROD ', 237.19133333333, 38.6725, '0.00', 237.19, 154.69, 0, 1, 23.2035),
(3793, 159, 'M20 X 1 GR8.8 BLK THREADED ROD ', 207.30666666667, 33.8, '0.00', 207.31, 135.2, 0, 1, 20.28),
(3792, 159, 'M20 HDG HEX NUTS', 5.704, 0.93, '0.00', 5.7, 3.72, 0, 1, 0.558),
(3791, 159, 'M20 X 70 HT BOLT HDG', 26.603333333333, 4.3375, '0.00', 26.6, 17.35, 0, 1, 2.6025),
(3790, 159, 'M20 X 65 HT BOLT HDG', 25.208, 4.11, '0.00', 25.21, 16.44, 0, 1, 2.466),
(3789, 159, 'M20 X 60 HT BOLT HDG', 19.534666666667, 3.185, '0.00', 19.53, 12.74, 0, 1, 1.911),
(3788, 159, 'M16 HDG FLT WASHERS DIN126 ', 0.92, 0.15, '0.00', 0.92, 0.6, 0, 1, 0.09),
(3787, 159, 'M16 X 1 GR8.8 GALV THREADED ROD', 154.22266666667, 25.145, '0.00', 154.22, 100.58, 0, 1, 15.087),
(3786, 159, 'M16 X 1 GR8.8 BLK THREADED ROD ', 145.176, 23.67, '0.00', 145.18, 94.68, 0, 1, 14.202),
(3785, 159, 'M16 HDG HEX NUTS', 2.9133333333333, 0.475, '0.00', 2.91, 1.9, 0, 1, 0.285),
(3782, 159, 'M16 X 75 HT BOLT HDG', 16.744, 2.73, '0.00', 16.74, 10.92, 0, 1, 1.638),
(3783, 159, 'M16 X 80 HT BOLT HDG ', 17.510666666667, 2.855, '0.00', 17.51, 11.42, 0, 1, 1.713),
(3784, 159, 'M16 X 90 HT BOLT HDG', 19.381333333333, 3.16, '0.00', 19.38, 12.64, 0, 1, 1.896),
(3781, 159, 'M16 X 70 HT BOLT HDG', 15.594, 2.5425, '0.00', 15.59, 10.17, 0, 1, 1.5255),
(3780, 159, 'M16 X 65 HT BOLT HDG', 15.057333333333, 2.455, '0.00', 15.06, 9.82, 0, 1, 1.473),
(3779, 159, 'M16 X 60 HT BOLT HDG', 14.152666666667, 2.3075, '0.00', 14.15, 9.23, 0, 1, 1.3845),
(3778, 159, 'M16 X 55 HT BOLT HDG', 13.294, 2.1675, '0.00', 13.29, 8.67, 0, 1, 1.3005),
(3777, 159, 'M16 X 50 HT BOLT HDG', 12.742, 2.0775, '0.00', 12.74, 8.31, 0, 1, 1.2465),
(3776, 159, 'M16 X 100 HT BOLT HDG ', 20.914666666667, 3.41, '0.00', 20.91, 13.64, 0, 1, 2.046),
(3775, 159, 'M14 X 1 GR8.8 GALV THREADED ROD', 133.86, 21.825, '0.00', 133.86, 87.3, 0, 1, 13.095),
(3774, 159, 'M14 X 1 GR8.8 BLK THREADED ROD', 119.14, 19.425, '0.00', 119.14, 77.7, 0, 1, 11.655),
(3773, 159, 'M14 HDG HEX NUTS ', 2.162, 0.3525, '0.00', 2.16, 1.41, 0, 1, 0.2115),
(3772, 159, 'M12 HDG FLT WASHERS DIN126 ', 0.49066666666667, 0.08, '0.00', 0.49, 0.32, 0, 1, 0.048),
(3771, 159, 'M12 X 1 GR8.8 GALV THREADED ROD', 84.134, 13.7175, '0.00', 84.13, 54.87, 0, 1, 8.2305),
(3770, 159, 'M12 X 1 GR8.8 BLK THREADED ROD ', 73.569333333333, 11.995, '0.00', 73.57, 47.98, 0, 1, 7.197),
(3769, 159, 'M12 HDG HEX NUTS', 1.5026666666667, 0.245, '0.00', 1.5, 0.98, 0, 1, 0.147),
(3768, 159, 'M12 X 60 HT BOLT HDG', 7.5593333333333, 1.2325, '0.00', 7.56, 4.93, 0, 1, 0.7395),
(3767, 159, 'M12 X 55 HT BOLT HDG', 7.1606666666667, 1.1675, '0.00', 7.16, 4.67, 0, 1, 0.7005),
(3766, 159, 'M12 X 50 HT BOLT HDG', 6.6086666666667, 1.0775, '0.00', 6.61, 4.31, 0, 1, 0.6465),
(3765, 159, 'M12 X 45 HT BOLT HDG', 4.9373333333333, 0.805, '0.00', 4.94, 3.22, 0, 1, 0.483),
(3764, 159, 'M12 X 40 HT BOLT HDG ', 4.508, 0.735, '0.00', 4.51, 2.94, 0, 1, 0.441),
(3763, 159, 'M12 X 100 HT BOLT HDG', 11.760666666667, 1.9175, '0.00', 11.76, 7.67, 0, 1, 1.1505),
(3762, 159, 'M10 HDG FLT WASHERS DIN126 ', 0.29133333333333, 0.0475, '0.00', 0.29, 0.19, 0, 1, 0.0285),
(3761, 159, 'M10 X 1 GR8.8 GALV THREADED ROD ', 56.779333333333, 9.2575, '0.00', 56.78, 37.03, 0, 1, 5.5545),
(3759, 159, 'M10 HDG HEX NUTS ', 1.0426666666667, 0.17, '0.00', 1.04, 0.68, 0, 1, 0.102),
(3760, 159, 'M10 X 1 GR8.8 BLK THREADED ROD ', 49.618666666667, 8.09, '0.00', 49.62, 32.36, 0, 1, 4.854),
(3758, 159, 'M10 X 75 HT BOLT HDG ', 6.5473333333333, 1.0675, '0.00', 6.55, 4.27, 0, 1, 0.6405),
(3757, 159, 'M10 X 50 HT BOLT HDG ', 4.7073333333333, 0.7675, '0.00', 4.71, 3.07, 0, 1, 0.4605),
(3756, 159, 'M10 X 45 HT BOLT HDG ', 4.4006666666667, 0.7175, '0.00', 4.4, 2.87, 0, 1, 0.4305),
(3755, 159, 'M10 X 40 HT BOLT HDG', 3.9866666666667, 0.65, '0.00', 3.99, 2.6, 0, 1, 0.39),
(3754, 159, 'PAINT BRUSH BEE 100mm', 88.933333333333, 14.5, '0.00', 88.93, 58, 0, 1, 8.7),
(3753, 159, 'PAINT BRUSH BEE 50mm ', 39.866666666667, 6.5, '0.00', 39.87, 26, 0, 1, 3.9),
(3752, 159, 'PAINT BRUSH BEE 25mm', 23, 3.75, '0.00', 23, 15, 0, 1, 2.25),
(3751, 159, 'TAPE MEASURE STANLEY P/LOCK 10mtr ', 490.66666666667, 80, '0.00', 490.67, 320, 0, 1, 48),
(3750, 159, 'SILICONE UNIVERSAL ACRYLIC 260ml', 38.333333333333, 6.25, '0.00', 38.33, 25, 0, 1, 3.75),
(3747, 159, 'Nitto Tape Insulation', 35.266666666667, 5.75, '0.00', 35.27, 23, 0, 1, 3.45),
(3748, 159, 'TAPE PTFE PIPE THREAD TAPE', 7.6666666666667, 1.25, '0.00', 7.67, 5, 0, 1, 0.75),
(3749, 159, 'Q20 LUBRICANT SPRAY 300gr ', 99.666666666667, 16.25, '0.00', 99.67, 65, 0, 1, 9.75),
(3746, 159, 'Lens Welding 108mm x 51mm 1000Hr', 5.06, 0.825, '0.00', 5.06, 3.3, 0, 1, 0.495),
(3745, 159, 'Lens Welding 108mm x 51mm Shade 10', 6.44, 1.05, '0.00', 6.44, 4.2, 0, 1, 0.63),
(3743, 159, 'Flip front helmet Standard', 65.933333333333, 10.75, '0.00', 65.93, 43, 0, 1, 6.45),
(3744, 159, 'Lens Welding 108mm x 51mm Shade 8', 1.84, 0.3, '0.00', 1.84, 1.2, 0, 1, 0.18),
(3741, 159, 'Rags - Super Absorbent (P/KG)(Blue Bags) Price per kg MOQ 25kg', 22.693333333333, 92.5, '0.00', 567.33, 14.8, 0, 25, 2.22),
(3742, 159, 'Pigskin VIP,Keystone Thumb,Tan (A GRADE )', 62.866666666667, 10.25, '0.00', 62.87, 41, 0, 1, 6.15),
(3740, 159, 'CHROME LEATHER APRON 60x120 ONEPIECE', 152.41333333333, 24.85, '0.00', 152.41, 99.4, 0, 1, 14.91),
(3739, 159, 'SAFETY HARD HAT BLUE SABS', 21.39, 3.4875, '0.00', 21.39, 13.95, 0, 1, 2.0925),
(3738, 159, 'Dromex Sport Spec YELLOW DV-12A-AF', 17.48, 2.85, '0.00', 17.48, 11.4, 0, 1, 1.71),
(3737, 159, 'Dromex Sport Spec Green DV-12GN', 12.128666666667, 1.9775, '0.00', 12.13, 7.91, 0, 1, 1.1865),
(3736, 159, 'Dromex Sport Spec Clear DV-12C', 12.128666666667, 1.9775, '0.00', 12.13, 7.91, 0, 1, 1.1865),
(3735, 159, 'Dromex Green Line 8 Inch WELD/6GR', 75.777333333333, 12.355, '0.00', 75.78, 49.42, 0, 1, 7.413),
(3734, 159, 'Green Lined,Welted Seams,Cotton Lined - 5cm Cuff', 55.353333333333, 9.025, '0.00', 55.35, 36.1, 0, 1, 5.415),
(3733, 159, 'PVC Glove,Medium Weight,27cm ', 19.78, 3.225, '0.00', 19.78, 12.9, 0, 1, 1.935),
(3732, 159, 'Wire cup brush Twisted 150mm X M14 ', 383.456, 62.52, '0.00', 383.46, 250.08, 0, 1, 37.512),
(3731, 159, 'FFP2 Dust Mask SABS Approved Box of 20 (MOQ 400) Carton', 3.68, 240, '0.00', 1472, 2.4, 0, 400, 0.36),
(3730, 159, 'FFP1 Dust Mask SABS Approved Box of 20 (MOQ 400) Carton', 3.5266666666667, 230, '0.00', 1410.67, 2.3, 0, 400, 0.345),
(3728, 159, 'Glue Devil - Spray Paint - Electric Blue ', 74.826666666667, 12.2, '0.00', 74.83, 48.8, 0, 1, 7.32),
(3729, 159, 'Dromex,Blue Mushroom Tri-Flange Corded (SNR 29)', 4.14, 67.5, '0.00', 414, 2.7, 0, 100, 0.405),
(3727, 159, 'Glue Devil - Spray Paint - Signal Red', 74.826666666667, 12.2, '0.00', 74.83, 48.8, 0, 1, 7.32),
(3726, 159, 'Glue Devil - Spray Paint - Canary Yellow', 74.826666666667, 12.2, '0.00', 74.83, 48.8, 0, 1, 7.32),
(3725, 159, 'Glue Devil - Spray Paint - Grass Green ', 74.826666666667, 12.2, '0.00', 74.83, 48.8, 0, 1, 7.32),
(3724, 159, 'Flash back arrestor acet 3/8 reg mount', 489.44, 79.8, '0.00', 489.44, 319.2, 0, 1, 47.88),
(3723, 159, 'EARTH MATWELD CLAMP CROCO 600A ', 131.25333333333, 21.4, '0.00', 131.25, 85.6, 0, 1, 12.84),
(3722, 159, 'Step Drill 4-22mm HSS Spiral ', 423.384, 69.03, '0.00', 423.38, 276.12, 0, 1, 41.418),
(3721, 159, 'Drill 22.0mm HSS (12.7mm shank', 654.19666666667, 106.6625, '0.00', 654.2, 426.65, 0, 1, 63.9975),
(3720, 159, 'Drill s/s 20mm HSS jobber', 834.21, 136.0125, '0.00', 834.21, 544.05, 0, 1, 81.6075),
(3719, 159, 'Drill s/s 18mm HSS jobber', 704.64333333333, 114.8875, '0.00', 704.64, 459.55, 0, 1, 68.9325),
(3718, 159, 'Drill s/s 16mm HSS jobber ', 555.02066666667, 90.4925, '0.00', 555.02, 361.97, 0, 1, 54.2955),
(3712, 159, 'Drill s/s 7mm HSS jobber', 71.269333333333, 11.62, '0.00', 71.27, 46.48, 0, 1, 6.972),
(3717, 159, 'Drill s/s 10mm HSS jobber', 162.288, 26.46, '0.00', 162.29, 105.84, 0, 1, 15.876),
(3716, 159, 'Drill s/s 14mm HSS jobber', 416.88266666667, 67.97, '0.00', 416.88, 271.88, 0, 1, 40.782),
(3715, 159, 'Drill s/s 12mm HSS jobber ', 232.162, 37.8525, '0.00', 232.16, 151.41, 0, 1, 22.7115),
(3714, 159, 'Drill s/s 11.5mm HSS jobbe', 211.10933333333, 34.42, '0.00', 211.11, 137.68, 0, 1, 20.652),
(3713, 159, 'Drill s/s 11.5mm HSS jobbe', 213.91533333333, 34.8775, '0.00', 213.92, 139.51, 0, 1, 20.9265),
(3711, 159, 'Drill s/s 6mm HSS jobber', 54.310666666667, 8.855, '0.00', 54.31, 35.42, 0, 1, 5.313),
(3710, 159, 'QD Medium Grey 200L', 17693.133333333, 2884.75, '0.00', 17693.13, 11539, 0, 1, 1730.85),
(3709, 159, 'Drum Deposit', 383.33333333333, 62.5, '0.00', 383.33, 250, 0, 1, 37.5),
(3708, 159, 'LACQUER THINNERS 100 - 210L price per Litre', 28.075333333333, 961.275, '0.00', 5895.82, 18.31, 0, 210, 2.7465),
(3707, 159, 'T41 230/3.0/22 A30V STEE Cutting (25 in a Box)', 44.788666666667, 182.5625, '0.00', 1119.72, 29.21, 0, 25, 4.3815),
(3704, 159, 'Lukas T27 230/7.0/22 A24X STEEL Cutting (10 In a Box)', 131.146, 213.825, '0.00', 1311.46, 85.53, 0, 10, 12.8295),
(3706, 159, 'Lukas T41 115/2.5/22 A30V STEEL Cutting (25 in a Box)', 26.572666666667, 108.3125, '0.00', 664.32, 17.33, 0, 25, 2.5995),
(3705, 159, 'Lukas T41 115/1.0/22 A46T RAZOR STL/INOX  Cutting Slim (20 in a Box)', 15.348666666667, 50.05, '0.00', 306.97, 10.01, 0, 20, 1.5015),
(3703, 159, 'Lukas T27 115/7.0/22 A24X STEEL Cutting (10 in a Box)', 48.668, 79.35, '0.00', 486.68, 31.74, 0, 10, 4.761),
(3701, 159, ' Lukas SLTR 115 ZK80 LAMEL  Flap Disc (10 in a Box)', 49.68, 81, '0.00', 496.8, 32.4, 0, 10, 4.86),
(3702, 159, 'Lukas  SLTR 178 ZK80 LAMEL Flap Disk (10 in a Box)', 135.94533333333, 221.65, '0.00', 1359.45, 88.66, 0, 10, 13.299),
(3700, 159, 'Lukas 50mmx50m P80 ECONOMY ROLL ', 669.852, 109.215, '0.00', 669.85, 436.86, 0, 1, 65.529),
(3699, 159, 'Lukas 50mmx50m P60 ECONOMY ROLL ', 707.72533333333, 115.39, '0.00', 707.73, 461.56, 0, 1, 69.234),
(3912, 160, 'Latex Examination Glove Powdered M ', 122.66666666667, 20, '0.00', 122.67, 80, 0, 1, 12),
(3911, 160, 'ER70S-6 MIG WIRE 0.8MM 5KG SPOOL Price per kg', 53.666666666667, 43.75, '0.00', 268.33, 35, 0, 5, 5.25),
(3910, 160, 'ER70S-6 MIG WIRE 1.2MM 15KG SPOOL price per kg', 39.866666666667, 97.5, '0.00', 598, 26, 0, 15, 3.9),
(3909, 160, 'LINER 0.6 - 0.9MM BLUE', 65.933333333333, 53.75, '0.00', 329.67, 43, 0, 5, 6.45),
(3908, 160, 'LINER 1.0 - 1.2MM RED', 65.933333333333, 53.75, '0.00', 329.67, 43, 0, 5, 6.45),
(3907, 160, 'CONTACT TIP M6 x  1.2', 9.5066666666667, 7.75, '0.00', 47.53, 6.2, 0, 5, 0.93),
(3906, 160, 'CONTACT TIP M6 x 0.8 ', 9.5066666666667, 1.55, '0.00', 9.51, 6.2, 0, 1, 0.93),
(3905, 160, 'SHROUD BNZ 25 CONICAL', 46, 7.5, '0.00', 46, 30, 0, 1, 4.5),
(3904, 160, 'SHROUD BNZ 15 CONICAL ', 24.533333333333, 4, '0.00', 24.53, 16, 0, 1, 2.4),
(3903, 160, 'SHROUD BNZ 40 CONICAL ', 81.266666666667, 13.25, '0.00', 81.27, 53, 0, 1, 7.95),
(3902, 160, 'SHROUD BNZ 36 CONICAL ', 72.066666666667, 11.75, '0.00', 72.07, 47, 0, 1, 7.05),
(3901, 160, 'GAS DIFFUSER BNZ 36', 7.59, 1.2375, '0.00', 7.59, 4.95, 0, 1, 0.7425),
(3900, 160, 'GAS DIFFUSER BNZ 40', 7.59, 1.2375, '0.00', 7.59, 4.95, 0, 1, 0.7425),
(3897, 160, 'TIP ADAPTORS BNZ 25 x M6', 16.866666666667, 2.75, '0.00', 16.87, 11, 0, 1, 1.65),
(3898, 160, 'CONTACT TIP M8 x 0.8', 12.19, 1.9875, '0.00', 12.19, 7.95, 0, 1, 1.1925),
(3899, 160, 'CONTACT TIP M8 x 1.2', 12.19, 1.9875, '0.00', 12.19, 7.95, 0, 1, 1.1925),
(3895, 160, 'TIP ADAPTORS BNZ 40 x M8', 19.933333333333, 3.25, '0.00', 19.93, 13, 0, 1, 1.95),
(3896, 160, 'TIP ADAPTORS BNZ 36 x M8 ', 13.309333333333, 2.17, '0.00', 13.31, 8.68, 0, 1, 1.302),
(3894, 160, 'Welding Rods E6013 - 3.2mm  Price per kg MOQ 5kg', 46, 37.5, '0.00', 230, 30, 0, 5, 4.5),
(3893, 160, '5 ROW WIRE BRUSH WOODEN HANDLE M/S ', 27.6, 4.5, '0.00', 27.6, 18, 0, 1, 2.7),
(3892, 160, 'TUNGSTEN ELECTRODE 2%THORIATED 2.4mm R/T ', 36.8, 6, '0.00', 36.8, 24, 0, 1, 3.6),
(3917, 161, 'MECHANICAL STROKE COUNTER', 291.33333333333, 237.5, '0.00', 1456.67, 190, 0, 5, 28.5),
(5792, 162, 'Double toweling Heat Glove 40cm Canvas Cuff', 109.25, 35.625, '0.00', 218.5, 71.25, 0, 2, 10.6875),
(4071, 163, 'Safety hard Cap with cap lamp bracket - White', 31.310666666667, 25.525, '0.00', 156.55, 20.42, 0, 5, 3.063),
(5791, 162, 'Glue Devil - Spray Paint - Grey', 74.826666666667, 48.8, '0.00', 299.31, 48.8, 0, 4, 7.32),
(5790, 162, 'Glue Devil - Spray Paint - Electric Blue', 74.826666666667, 73.2, '0.00', 448.96, 48.8, 0, 6, 7.32),
(5789, 162, 'Aluminium cap bracket for Visor', 84.333333333333, 412.5, '0.00', 2530, 55, 0, 30, 8.25),
(5788, 162, 'Face Shield replacement visor clear', 39.866666666667, 65, '0.00', 398.67, 26, 0, 10, 3.9),
(5787, 162, 'Dromex Cotton knitted,Crochet,600gpd - Gloves', 5.106, 249.75, '0.00', 1531.8, 3.33, 0, 300, 0.4995),
(5786, 162, 'Red Heat Resistant Glove Elbow', 88.166666666667, 431.25, '0.00', 2645, 57.5, 0, 30, 8.625);
INSERT INTO `tb_quote_items` (`item_id`, `item_quote_id`, `item_product`, `item_price`, `item_profit`, `item_discount`, `item_subtotal`, `item_cost`, `item_supplier_id`, `item_qty`, `item_vat`) VALUES
(5785, 162, 'Rags - Super Absorbent (Blue Bags) Price per kg', 21.773333333333, 355, '0.00', 2177.33, 14.2, 0, 100, 2.13),
(5784, 162, 'CABLE TIE HT BLACK 310X4.8MM PK100 T50I ', 153.33333333333, 100, '0.00', 613.33, 100, 0, 4, 15),
(5783, 162, 'FFP2 Dust Mask SABS Approved', 3.68, 180, '0.00', 1104, 2.4, 0, 300, 0.36),
(5782, 162, 'Toilet Paper Virgin 1 ply 48\'s', 220.8, 180, '0.00', 1104, 144, 0, 5, 21.6),
(4069, 163, 'Face Shield replacement visor clear', 39.866666666667, 6.5, '0.00', 39.87, 26, 0, 1, 3.9),
(4070, 163, 'Aluminium cap bracket for hard hat', 84.333333333333, 13.75, '0.00', 84.33, 55, 0, 1, 8.25),
(4068, 163, 'Wayne Gripper Black Gumboot STC Size 12', 252.08, 41.1, '0.00', 252.08, 164.4, 0, 1, 24.66),
(4067, 163, 'Wayne Gripper Black Gumboot STC Size 10', 252.08, 82.2, '0.00', 504.16, 164.4, 0, 2, 24.66),
(4066, 163, 'Wayne Gripper Black Gumboot STC Size 9', 252.08, 164.4, '0.00', 1008.32, 164.4, 0, 4, 24.66),
(4064, 163, 'Wayne Gripper Black Gumboot STC Size 6', 252.08, 82.2, '0.00', 504.16, 164.4, 0, 2, 24.66),
(4065, 163, 'Wayne Gripper Black Gumboot STC Size 8', 252.08, 41.1, '0.00', 252.08, 164.4, 0, 1, 24.66),
(4063, 163, 'Wayne Gripper Black Gumboot STC Size 4', 252.08, 41.1, '0.00', 252.08, 164.4, 0, 1, 24.66),
(4062, 163, 'Cut Resistatnd Glove Level 5', 53.666666666667, 315, '0.00', 1932, 35, 0, 36, 5.25),
(4061, 163, 'Dromex Earplugs ,Uncorded,Yellow (NRR 29db - SNR 33db)', 2.3, 75, '0.00', 460, 1.5, 0, 200, 0.225),
(4060, 163, 'Dromex Earplugs , Mushroom Tri-Flange Corded (SNR 29)', 3.3733333333333, 55, '0.00', 337.33, 2.2, 0, 100, 0.33),
(4059, 163, 'Socks - Miners mottled grey (with Ties) ', 39.713333333333, 310.8, '0.00', 1906.24, 25.9, 0, 48, 3.885),
(4058, 163, 'Leather Apron 60 x 120 ', 168.66666666667, 27.5, '0.00', 168.67, 110, 0, 1, 16.5),
(4057, 163, 'Dromex PVC Rubberised Rain Suit Yellow L', 152.61266666667, 124.4125, '0.00', 763.06, 99.53, 0, 5, 14.9295),
(4056, 163, 'White PVC Apron Heavy Duty 400gm', 39.866666666667, 6.5, '0.00', 39.87, 26, 0, 1, 3.9),
(4055, 163, 'Dromex Spectacle SPORT Style Clear', 12.128666666667, 94.92, '0.00', 582.18, 7.91, 0, 48, 1.1865),
(4054, 163, 'Rebel Kontrakta Boot size 11', 502.78, 163.95, '0.00', 1005.56, 327.9, 0, 2, 49.185),
(4053, 163, 'Rebel Kontrakta Boot size 10', 502.78, 245.925, '0.00', 1508.34, 327.9, 0, 3, 49.185),
(4052, 163, 'Rebel Kontrakta Boot size 9', 502.78, 327.9, '0.00', 2011.12, 327.9, 0, 4, 49.185),
(4051, 163, 'Rebel Kontrakta Boot size 8', 502.78, 245.925, '0.00', 1508.34, 327.9, 0, 3, 49.185),
(4050, 163, 'Rebel Kontrakta Boot size 7', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(4072, 163, 'Safety hard Cap with cap lamp bracket - Yellow', 31.310666666667, 25.525, '0.00', 156.55, 20.42, 0, 5, 3.063),
(4073, 163, 'Cap Lamp Belt Padded & Shoulder Straps', 590.33333333333, 481.25, '0.00', 2951.67, 385, 0, 5, 57.75),
(4080, 164, 'Names Embroided', 21.466666666667, 112, '0.00', 686.93, 14, 0, 32, 2.1),
(4081, 164, 'Logo Digitizing Once off', 184, 30, '0.00', 184, 120, 0, 1, 18),
(4079, 164, 'Bora Mining Logo', 24.533333333333, 128, '0.00', 785.07, 16, 0, 32, 2.4),
(4078, 164, 'Dromex J54 SABS 100% COTTON BOILER SUITS, WITH REFLECTIVE All Sizes', 472.48133333333, 2465.12, '0.00', 15119.4, 308.14, 0, 32, 46.221),
(4085, 166, 'Dromex Double Respirator', 92.720666666667, 10582.25, '0.00', 64904.47, 60.47, 0, 700, 9.0705),
(4084, 166, 'Dromex Single Respirator', 85.575333333333, 9766.75, '0.00', 59902.73, 55.81, 0, 700, 8.3715),
(5647, 167, 'GLOVE; CHEMICAL; NEOPRENE MEDIUM; DISPOSABLE; BLUE', 20.684666666667, 30.3525, '0.00', 186.16, 13.49, 0, 9, 2.0235),
(5779, 169, 'Band-It Stainless steel Strapping 19mm x 0.5mm x 30m', 1203.6666666667, 392.5, '0.00', 2407.33, 785, 0, 2, 117.75),
(5641, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 44; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 6271.5, '0.00', 38465.2, 339, 0, 74, 50.85),
(5642, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 46; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 3220.5, '0.00', 19752.4, 339, 0, 38, 50.85),
(5643, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 48; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 1017, '0.00', 6237.6, 339, 0, 12, 50.85),
(5644, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 36; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 8051.25, '0.00', 49381, 339, 0, 95, 50.85),
(5645, 167, 'BARRON CAP; BUMP; BLACK; SAFETY; UNBRANDED  ', 46, 277.5, '0.00', 1702, 30, 0, 37, 4.5),
(5646, 167, 'Lime Hiviz golf cap with reflective ', 93.533333333333, 2226.5, '0.00', 13655.87, 61, 0, 146, 9.15),
(5636, 167, 'GLOVE; LATEX EXAMINATION; POWDERED; PACK OF 100; MEDIUM ', 119.6, 20650.5, '0.00', 126656.4, 78, 0, 1059, 11.7),
(5640, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 42; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 9237.75, '0.00', 56658.2, 339, 0, 109, 50.85),
(5639, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 40; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 5169.75, '0.00', 31707.8, 339, 0, 61, 50.85),
(5638, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 38; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 8051.25, '0.00', 49381, 339, 0, 95, 50.85),
(5637, 167, 'DROMEX OVERALL; BOILERMAKER; PROBAN; SIZE 36; 100 COTTON; FLAME; RETARDANT; PPE ', 519.8, 8051.25, '0.00', 49381, 339, 0, 95, 50.85),
(4142, 168, 'Dromex PROMAX white Disposable Overalls, Small to 3XL', 76.666666666667, 250, '0.00', 1533.33, 50, 0, 20, 7.5),
(4141, 168, 'Dromex Black PU palm coated on black knitted shell, size 9', 10.518666666667, 85.75, '0.00', 525.93, 6.86, 0, 50, 1.029),
(4140, 168, 'Dromex Black PU palm coated on black knitted shell, size 8', 10.518666666667, 171.5, '0.00', 1051.87, 6.86, 0, 100, 1.029),
(4139, 168, 'FFP2 Dust Mask SABS Approved', 3.68, 600, '0.00', 3680, 2.4, 0, 1000, 0.36),
(4138, 168, 'FFP1 Dust Mask SABS Approved', 3.5266666666667, 575, '0.00', 3526.67, 2.3, 0, 1000, 0.345),
(5635, 167, '3M 6059,Cartridge - ABEK1', 222.33333333333, 2356.25, '0.00', 14451.67, 145, 0, 65, 21.75),
(5630, 167, 'HiViz All Weather Jacket Orange 3XL', 299, 682.5, '0.00', 4186, 195, 0, 14, 29.25),
(5631, 167, 'DROMEX BLACK GLOVE; NINJA FLEX; SIZE L', 10.518666666667, 10519.81, '0.00', 64521.5, 6.86, 0, 6134, 1.029),
(5632, 167, 'DROMEX GOGGLES IN-DIRECT ULTIMATE VISION, WIDE BAND ELASTIC', 76.666666666667, 800, '0.00', 4906.67, 50, 0, 64, 7.5),
(5633, 167, '3M 6300,Half Mask (Facepiece)', 337.33333333333, 4070, '0.00', 24962.67, 220, 0, 74, 33),
(5634, 167, '3M 6800,Full Face Mask (Facepiece)', 4293.3333333333, 28700, '0.00', 176026.67, 2800, 0, 41, 420),
(5629, 167, 'HiViz All Weather Jacket Orange 2XL', 299, 1950, '0.00', 11960, 195, 0, 40, 29.25),
(5628, 167, 'HiViz All Weather Jacket Orange XL', 299, 6337.5, '0.00', 38870, 195, 0, 130, 29.25),
(5625, 167, 'JACKET; WELDING; GREY; SIZE; 2XL', 410.93333333333, 22512, '0.00', 138073.6, 268, 0, 336, 40.2),
(5627, 167, 'HiViz All Weather Jacket Orange L', 299, 24960, '0.00', 153088, 195, 0, 512, 29.25),
(5626, 167, 'HiViz All Weather Jacket Orange (M)', 299, 26958.75, '0.00', 165347, 195, 0, 553, 29.25),
(5624, 167, 'JACKET; WELDING; GREY; SIZE;XL', 410.93333333333, 22512, '0.00', 138073.6, 268, 0, 336, 40.2),
(5622, 167, 'JACKET; WELDING; GREY; SIZE; M', 438.45666666667, 24019.8, '0.00', 147321.44, 285.95, 0, 336, 42.8925),
(5623, 167, 'JACKET; WELDING; GREY; SIZE; L', 410.93333333333, 22512, '0.00', 138073.6, 268, 0, 336, 40.2),
(5621, 167, 'SPAT MEDIUM KNEE WELDERS\' PR BS EN; ', 95.879333333333, 672.1975, '0.00', 4122.81, 62.53, 0, 43, 9.3795),
(5620, 167, 'RED HEAT RESISTANT GLOVES WRIST', 68.233333333333, 25587.5, '0.00', 156936.67, 44.5, 0, 2300, 6.675),
(5619, 167, 'CHROME LEATHER DOUBLE PALM; RIGGING; HEAVY DUTY; DBL PALM EUROPEAN; EN60903', 33.794666666667, 22960.17, '0.00', 140822.38, 22.04, 0, 4167, 3.306),
(5618, 167, 'Pigskin VIP,Keystone Thumb,Tan (A GRADE )', 45.08, 7497, '0.00', 45981.6, 29.4, 0, 1020, 4.41),
(5617, 167, 'DROMEX GLOVES; LATEX; HOUSEHOLD; SIZE L; PR', 9.5066666666667, 14712.6, '0.00', 90237.28, 6.2, 0, 9492, 0.93),
(5616, 167, 'LIME Reflective Vest , ZIP, ID POUCH 3XL', 35.266666666667, 161, '0.00', 987.47, 23, 0, 28, 3.45),
(5602, 167, 'Safety Caps - 6 Point Inner (SABS) Jockey Type (SAFECO)', 23.613333333333, 4924.15, '0.00', 30201.45, 15.4, 0, 1279, 2.31),
(5603, 167, 'Double lanyard full body harness with snap hook', 490.66666666667, 44320, '0.00', 271829.33, 320, 0, 554, 48),
(5604, 167, 'GAS WELDING GOGGLE FLIPFRONT SQUARE LENSES 108 x 51', 22.555333333333, 3.6775, '0.00', 22.56, 14.71, 0, 1, 2.2065),
(5605, 167, 'Lens Clear Glass (108x51mm)', 4.83, 2192.4, '0.00', 13446.72, 3.15, 0, 2784, 0.4725),
(5606, 167, 'Lens Shade 10 (108x51mm)', 5.6733333333333, 1826.875, '0.00', 11204.83, 3.7, 0, 1975, 0.555),
(5607, 167, 'Dromex Fluorescent Green Bell PU Foam Disposable & un corded Earplug 200 per pack', 2.0086666666667, 152.2875, '0.00', 934.03, 1.31, 0, 465, 0.1965),
(5608, 167, 'A1,Cartridge - Spraypaint, Organic Gases                      ', 45.386666666667, 27772.2, '0.00', 170336.16, 29.6, 0, 3753, 4.44),
(5609, 167, 'DROMEX SPECTACLES; SAFETY; CLEAR; TOUGH; SAFETY GLASSES; EURO', 13.907333333333, 8840.9825, '0.00', 54224.69, 9.07, 0, 3899, 1.3605),
(5610, 167, 'STRAP; CHIN; FOR HARD HAT; NYLON; EUROPEAN CE ', 14.106666666667, 193.2, '0.00', 1184.96, 9.2, 0, 84, 1.38),
(5615, 167, 'LIME Reflective Vest , ZIP, ID POUCH 2XL', 35.266666666667, 299, '0.00', 1833.87, 23, 0, 52, 3.45),
(5614, 167, 'LIME Reflective Vest , ZIP, ID POUCH XL', 35.266666666667, 1023.5, '0.00', 6277.47, 23, 0, 178, 3.45),
(5613, 167, 'LIME Reflective Vest , ZIP, ID POUCH L', 35.266666666667, 3438.5, '0.00', 21089.47, 23, 0, 598, 3.45),
(5612, 167, 'LIME Reflective Vest , ZIP, ID POUCH M', 35.266666666667, 3444.25, '0.00', 21124.73, 23, 0, 599, 3.45),
(5611, 167, 'LIME Reflective Vest , ZIP, ID POUCH S', 35.266666666667, 1575.5, '0.00', 9663.07, 23, 0, 274, 3.45),
(5601, 167, 'GAS WELDING GOGGLE FLIPFRONT ROUND LENSES', 28.29, 461.25, '0.00', 2829, 18.45, 0, 100, 2.7675),
(5599, 167, 'DROMEX GLOVES; UNIGRIP;ANTICU LEVEL 5T; NON SLIP; CUT; EN388; RESIST; ISSUE A PACK OF 12;', 48.944, 31728.48, '0.00', 194601.34, 31.92, 0, 3976, 4.788),
(5600, 167, 'LEATHER; GREEN; 380MM LONG; PKT OF 12 BOILERMAKER EUROPEAN EN60903;  EN388    ', 65.933333333333, 7299.25, '0.00', 44768.73, 43, 0, 679, 6.45),
(5597, 167, 'PVC Red Glove Open Cuff 40cm', 21.006666666667, 3075.65, '0.00', 18863.99, 13.7, 0, 898, 2.055),
(5598, 167, 'PVC Red Glove Open Cuff 27cm', 19.013333333333, 3286, '0.00', 20154.13, 12.4, 0, 1060, 1.86),
(5596, 167, 'DROMEX GLOVES; CANDY STRIPE / GEN PURPOSE EN388                         ', 26.066666666667, 299.25, '0.00', 1642.2, 17, 0, 63, 2.85),
(5595, 167, 'FACESHIELD', 42.933333333333, 5159, '0.00', 31641.87, 28, 0, 737, 4.2),
(5589, 167, 'DROMEX; COVERALL; DISPOSABLE; SIZE 2XL; PROMAX; SABS; ISO 90001 SANS 1397 2003   ', 65.933333333333, 6288.75, '0.00', 38571, 43, 0, 585, 6.45),
(5590, 167, 'DROMEX; RESPIRATOR; WELD FUMES; DRO; AIR; DISP MOULDED MASK; 10 PER BOX;  FFP3 ', 251.46666666667, 42025, '0.00', 257753.33, 164, 0, 1025, 24.6),
(5591, 167, 'APRON; WELDERS 60 x 120 ONE PIECE', 153.33333333333, 21875, '0.00', 134166.67, 100, 0, 875, 15),
(5592, 167, 'DROMEX MIDIMASK PVC Single Mask - BLUE (NRCS: AZ2011/43)', 79.733333333333, 41990, '0.00', 257538.67, 52, 0, 3230, 7.8),
(5593, 167, 'FFP2 Dust Mask SABS Approved', 3.3733333333333, 1776.5, '0.00', 10895.87, 2.2, 0, 3230, 0.33),
(5594, 167, 'FLIP FRONT WELDING HELMET', 61.333333333333, 4670, '0.00', 28642.67, 40, 0, 467, 6),
(5586, 167, 'DROMEX; COVERALL; DISPOSABLE; SIZE M; PROMAX; SABS; ISO 90001 SANS 1397 2003   ', 65.933333333333, 45816.5, '0.00', 281007.87, 43, 0, 4262, 6.45),
(5588, 167, 'DROMEX; COVERALL; DISPOSABLE; SIZE XL; PROMAX; SABS; ISO 90001 SANS 1397 2003   ', 65.933333333333, 19253.25, '0.00', 118086.6, 43, 0, 1791, 6.45),
(5587, 167, 'DROMEX; COVERALL; DISPOSABLE; SIZE L; PROMAX; SABS; ISO 90001 SANS 1397 2003   ', 65.933333333333, 54201.5, '0.00', 332435.87, 43, 0, 5042, 6.45),
(5585, 167, 'DROMEX; EARMUFF; HELMET MOUNTED; INTEREX; EN352 2002  ', 191.66666666667, 2187.5, '0.00', 13416.67, 125, 0, 70, 18.75),
(5584, 167, 'DROMEX;  SPECTACLES; SAFETY; TINTED; TOUGH; ISSUE A PKG12; DV-55G-AF ', 30.850666666667, 8862.86, '0.00', 54358.87, 20.12, 0, 1762, 3.018),
(5583, 167, 'DROMEX RAINSUIT; 2 PIECE; RUBBERIZED; 50MM;REFLECTIVE; SIZE 3XL', 153.33333333333, 2550, '0.00', 15640, 100, 0, 102, 15),
(5582, 167, 'DROMEX RAINSUIT; 2 PIECE; RUBBERIZED; 50MM;REFLECTIVE; SIZE 2XL', 153.33333333333, 6350, '0.00', 38946.67, 100, 0, 254, 15),
(5581, 167, 'DROMEX RAINSUIT; 2 PIECE; RUBBERIZED; 50MM;REFLECTIVE; SIZE XL', 153.33333333333, 16400, '0.00', 100586.67, 100, 0, 656, 15),
(5580, 167, 'DROMEX RAINSUIT; 2 PIECE; RUBBERIZED; 50MM;REFLECTIVE; SIZE L', 153.33333333333, 37200, '0.00', 228160, 100, 0, 1488, 15),
(5579, 167, 'DROMEX RAINSUIT; 2 PIECE; RUBBERIZED; 50MM;REFLECTIVE; SIZE M', 153.33333333333, 47825, '0.00', 293326.67, 100, 0, 1913, 15),
(5578, 167, 'DROMEX RAINSUIT; 2 PIECE; RUBBERIZED; 50MM;REFLECTIVE; SIZE S', 153.33333333333, 14475, '0.00', 88780, 100, 0, 579, 15),
(5778, 169, 'P2 Cartridges (Dust Cartridge)', 55.506666666667, 271.5, '0.00', 1665.2, 36.2, 0, 30, 5.43),
(5781, 170, 'Cotton Crochet gloves ', 4.922, 240.75, '0.00', 1476.6, 3.21, 0, 300, 0.4815),
(5813, 171, 'Orange Reflective Vest with Zip & ID XL', 37.444, 122.1, '0.00', 748.88, 24.42, 0, 20, 3.663),
(5812, 171, 'Orange Reflective Vest with Zip & ID L', 37.444, 122.1, '0.00', 748.88, 24.42, 0, 20, 3.663),
(5811, 171, 'Orange Reflective Vest with Zip & ID M', 37.444, 122.1, '0.00', 748.88, 24.42, 0, 20, 3.663),
(5915, 172, 'Dromex Chrome leather candy stripe glove', 26.496, 216, '0.00', 1324.8, 17.28, 0, 50, 2.592),
(6908, 173, 'FFP2 Dust Mask SABS Approved', 3.68, 60, '0.00', 368, 2.4, 0, 100, 0.36),
(6907, 173, 'Rags Super absorbent /kg', 21.77, 88.75, '0.00', 544.33, 14.2, 0, 25, 2.13),
(6906, 173, 'Virgin toilet paper 1ply 48\'s', 220.8, 72, '0.00', 441.6, 144, 0, 2, 21.6),
(6092, 175, 'DROMEX Dispenser (includes 1000 prs of ear plugs)', 2193.02, 357.5575, '0.00', 2193.02, 1430.23, 0, 1, 214.5345),
(6946, 174, '2 ply Virgin Toilet Paper 48\'s (Special til Month end)', 246.87, 120.75, '0.00', 740.6, 161, 0, 3, 24.15),
(6952, 178, 'Safety Hard Cap Blue', 21.39, 34.875, '0.00', 213.9, 13.95, 0, 10, 2.0925),
(6945, 174, '1 ply Virgin Toilet Paper 48\'s', 220.8, 108, '0.00', 662.4, 144, 0, 3, 21.6),
(6944, 174, 'DROMEX AGRIMac BIB PANTS, XLARGE (Storm)', 431.79, 140.8, '0.00', 863.57, 281.6, 0, 2, 42.24),
(6943, 174, 'DROMEX AGRIMac JACKET, XLARGE (Storm)', 442.17, 144.185, '0.00', 884.33, 288.37, 0, 2, 43.2555),
(6941, 174, 'Dromex Chrome leather double palm  wrist length 2.5', 37.44, 73.26, '0.00', 449.33, 24.42, 0, 12, 3.663),
(6942, 174, 'P2 Cartridges (Dust Cartridge)', 55.51, 271.5, '0.00', 1665.2, 36.2, 0, 30, 5.43),
(6940, 174, 'FFP2 Dust Mask SABS Approved', 3.68, 180, '0.00', 1104, 2.4, 0, 300, 0.36),
(6939, 174, 'Dromex Clear mono goggle direct vent', 12.93, 10.5375, '0.00', 64.63, 8.43, 0, 5, 1.2645),
(6937, 174, 'Citronol Hand Cleaner with grit 30kg', 810.01, 132.0675, '0.00', 810.01, 528.27, 0, 1, 79.2405),
(6938, 174, 'Dromex Spectacle EURO Green adjustable Frame', 13.91, 27.21, '0.00', 166.89, 9.07, 0, 12, 1.3605),
(6936, 174, 'Wire Nails 75mm / kg', 46, 22.5, '0.00', 138, 30, 0, 3, 4.5),
(6935, 174, 'Dromex Yellow household Glove with Flock Liner', 9.15, 22.3875, '0.00', 137.31, 5.97, 0, 15, 0.8955),
(6091, 175, 'Dromex Ear Plug Tri Flange, Reusable Corded', 3.37, 55, '0.00', 337.33, 2.2, 0, 100, 0.33),
(6090, 175, 'Dromex Ear Plug uncorded disposable, PU foam', 2.01, 65.5, '0.00', 401.73, 1.31, 0, 200, 0.1965),
(6934, 174, 'Gas Cartridges 190g', 47.53, 77.5, '0.00', 475.33, 31, 0, 10, 4.65),
(6933, 174, 'Red Heat  Resistant leather  glove, elbow length ', 83.72, 163.8, '0.00', 1004.64, 54.6, 0, 12, 8.19),
(6290, 176, 'PVC Red Glove Open Cuff 40cm', 21, 16845.711, '0.00', 103320.36, 13.6957, 0, 4920, 2.054355),
(6932, 174, 'Blue lined  welding glove elbow length ', 83.72, 163.8, '0.00', 1004.64, 54.6, 0, 12, 8.19),
(6836, 177, '50mm Steel fluted Nails/kg', 84.33, 275, '0.00', 1686.67, 55, 0, 20, 8.25),
(6835, 177, '100mm wire Nails/kg', 46, 75, '0.00', 460, 30, 0, 10, 4.5),
(6834, 177, '75mm wire Nails/kg', 46, 75, '0.00', 460, 30, 0, 10, 4.5),
(6833, 177, 'LEVEL SPIRIT 1000mm ', 191.67, 125, '0.00', 766.67, 125, 0, 4, 18.75),
(6829, 177, 'RAIN GAUGE MTS 100MM (L)', 67.47, 11, '0.00', 67.47, 44, 0, 1, 6.6),
(6830, 177, 'Wire Brush', 46, 7.5, '0.00', 46, 30, 0, 1, 4.5),
(6831, 177, 'BRUSH CUP 75x14x2 ', 115, 18.75, '0.00', 115, 75, 0, 1, 11.25),
(6832, 177, 'QD PRIMER RED OXIDE - 5 ltrl ', 350.67, 228.7, '0.00', 1402.69, 228.7, 0, 4, 34.305),
(6828, 177, 'CHISEL AFTOOL COLD FLAT 200X19MM W/GRIP ', 277.23, 180.8, '0.00', 1108.91, 180.8, 0, 4, 27.12),
(6827, 177, 'JERRYCAN MTS METAL 20 LITRE / Fuel or Diesel', 809.6, 264, '0.00', 1619.2, 528, 0, 2, 79.2),
(6826, 177, 'MTS BUILDERS BUCKET ROUND 11LT ', 73.6, 120, '0.00', 736, 48, 0, 10, 7.2),
(6825, 177, 'Float MTS Plastic 280X115mm', 24.53, 48, '0.00', 294.4, 16, 0, 12, 2.4),
(6824, 177, 'Boiler Markers Chalk', 3.99, 2.6, '0.00', 15.95, 2.6, 0, 4, 0.39),
(6822, 177, 'Broom platform 600mm Hard', 115, 93.75, '0.00', 575, 75, 0, 5, 11.25),
(6823, 177, 'Chalk Reel + Powder set', 76.67, 50, '0.00', 306.67, 50, 0, 4, 7.5),
(6821, 177, 'Tape Powerlock Stanley 8MX25mm', 306.67, 250, '0.00', 1533.33, 200, 0, 5, 30),
(6820, 177, 'Glue Devil - Spray Paint - Signal Red', 74.83, 61, '0.00', 374.13, 48.8, 0, 5, 7.32),
(6819, 177, '50mm Paint Brush', 40, 6.5225, '0.00', 40, 26.09, 0, 1, 3.9135),
(6817, 177, 'Genkem Adhesive Contact 5ltr', 908.96, 296.4, '0.00', 1817.92, 592.8, 0, 2, 88.92),
(6818, 177, 'Hacksaw blade 24TPI s/proof', 15.33, 2.5, '0.00', 15.33, 10, 0, 1, 1.5),
(6816, 177, 'Waco Extension cord 20M +Janus White', 533.2, 86.935, '0.00', 533.2, 347.74, 0, 1, 52.161),
(6815, 177, 'Rebel Kontrakta Boot size 3-14', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(6814, 177, 'ROKO CHUKKA Boots Size 3 -12', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(6813, 177, 'Polycotton Conti suits Royal Blue size 28-44', 151.8, 24.75, '0.00', 151.8, 99, 0, 1, 14.85),
(6812, 177, 'Dromex D59 Flame and Acid Pants All Sizes', 337.33, 55, '0.00', 337.33, 220, 0, 1, 33),
(6811, 177, 'Dromex D59 Flame and Acid Jacket All Sizes', 337.33, 55, '0.00', 337.33, 220, 0, 1, 33),
(6810, 177, 'Green lined glove elbow length 8', 73.09, 1191.75, '0.00', 7309.4, 47.67, 0, 100, 7.1505),
(6808, 177, 'Face Shield clear complete', 45.85, 14.95, '0.00', 91.69, 29.9, 0, 2, 4.485),
(6809, 177, 'Chrome Leather Welding Apron 1 piece  60x 120', 152.41, 2485, '0.00', 15241.33, 99.4, 0, 100, 14.91),
(6805, 177, 'Dromex Ear Plug Tri Flange, Reusable', 3.37, 55, '0.00', 337.33, 2.2, 0, 100, 0.33),
(6806, 177, 'Dromex Ear Plug uncorded disposable, PU foam', 2.01, 32.75, '0.00', 200.87, 1.31, 0, 100, 0.1965),
(6807, 177, 'Flip front helmet Standard', 65.93, 21.5, '0.00', 131.87, 43, 0, 2, 6.45),
(6800, 177, 'Safety Hard Cap White', 21.39, 17.4375, '0.00', 106.95, 13.95, 0, 5, 2.0925),
(6801, 177, 'Safety Hard Cap Red', 21.39, 10.4625, '0.00', 64.17, 13.95, 0, 3, 2.0925),
(6802, 177, 'Dromex Chrome leather double palm  wrist length 2.5', 37.44, 610.5, '0.00', 3744.4, 24.42, 0, 100, 3.663),
(6803, 177, 'Dromex Chrome leather double palm elbow length 8', 46.89, 764.5, '0.00', 4688.93, 30.58, 0, 100, 4.587),
(6804, 177, 'Clear mono goggle direct vent', 12.93, 105.375, '0.00', 646.3, 8.43, 0, 50, 1.2645),
(6797, 177, 'Dromex PVC Red Glove Knit Wrist', 14.86, 242.25, '0.00', 1485.8, 9.69, 0, 100, 1.4535),
(6798, 177, 'Dromex PVC Red Glove Open Cuff 35cm', 21.13, 344.5, '0.00', 2112.93, 13.78, 0, 100, 2.067),
(6799, 177, 'Safety Hard Cap Grey', 21.39, 87.1875, '0.00', 534.75, 13.95, 0, 25, 2.0925),
(6796, 177, 'FFP2 Dust Mask SABS Approved', 3.68, 120, '0.00', 736, 2.4, 0, 200, 0.36),
(6951, 178, 'ABEK1 6059 Cartridge ', 242.73, 474.9, '0.00', 2912.72, 158.3, 0, 12, 23.745),
(6950, 178, 'Chrome Leather Yoke  2XL', 227.67, 111.36, '0.00', 683.01, 148.48, 0, 3, 22.272),
(6947, 178, 'Dromex Chrome leather double palm  wrist length 2.5', 37.44, 146.52, '0.00', 898.66, 24.42, 0, 24, 3.663),
(6948, 178, 'Dromex Chrome leather double palm elbow length 8', 46.89, 183.48, '0.00', 1125.34, 30.58, 0, 24, 4.587),
(6949, 178, '150 x 225 Hand Pad Green (Pack of 10)', 179.4, 117, '0.00', 717.6, 117, 0, 4, 17.55),
(6894, 179, 'Electric Urn - stainless Steel Water Heater Urn 28L', 1303.33, 425, '0.00', 2606.67, 850, 0, 2, 127.5),
(9511, 180, 'Insulation Tape Nitto 18x20m Yellow', 41.71, 6.8, '0.00', 41.71, 27.2, 0, 1, 4.08),
(9510, 180, 'Insulation Tape Nitto 18x20m White', 41.71, 6.8, '0.00', 41.71, 27.2, 0, 1, 4.08),
(9509, 180, 'Insulation Tape Nitto 18x20m Black', 41.71, 6.8, '0.00', 41.71, 27.2, 0, 1, 4.08),
(9508, 180, 'Insulation Tape Nitto 18x20m Red ', 41.71, 6.8, '0.00', 41.71, 27.2, 0, 1, 4.08),
(9507, 180, 'Metaguard Clear - PER PAIR ', 98.13, 16, '0.00', 98.13, 64, 0, 1, 9.6),
(9506, 180, 'TAPE STANLEY TYLON 3X13MM STHT36190 ', 112.85, 18.4, '0.00', 112.85, 73.6, 0, 1, 11.04),
(9505, 180, 'Tape measuring 3M auto lock', 42.93, 7, '0.00', 42.93, 28, 0, 1, 4.2),
(9504, 180, 'Masking tape 48mmx40M G/P', 65.83, 10.7325, '0.00', 65.83, 42.93, 0, 1, 6.4395),
(9503, 180, 'Dromex Weld Curtain 3M X 2M WELDSCR-2X3 ', 369.53, 60.25, '0.00', 369.53, 241, 0, 1, 36.15),
(9502, 180, 'RED LINER 4.5M ', 65.93, 10.75, '0.00', 65.93, 43, 0, 1, 6.45),
(9501, 180, 'SHORT BACK CAP', 14.57, 2.375, '0.00', 14.57, 9.5, 0, 1, 1.425),
(9500, 180, 'LONG BACK CAP', 16.87, 2.75, '0.00', 16.87, 11, 0, 1, 1.65),
(9499, 180, 'ALUMINA 10N46 NO 10 CERAMIC ', 14.41, 2.35, '0.00', 14.41, 9.4, 0, 1, 1.41),
(9496, 180, 'ALUMINA 10N50 NO 4 CERAMIC', 7.59, 1.2375, '0.00', 7.59, 4.95, 0, 1, 0.7425),
(9497, 180, 'ALUMINA 10N49 NO 5 CERAMIC', 7.59, 1.2375, '0.00', 7.59, 4.95, 0, 1, 0.7425),
(9498, 180, 'ALUMINA 10N46 NO 8 CERAMIC ', 7.59, 1.2375, '0.00', 7.59, 4.95, 0, 1, 0.7425),
(9495, 180, 'MACHINE PANEL SOCKET FEM LUG TYPE 50-70 ', 87.4, 28.5, '0.00', 174.8, 57, 0, 2, 8.55),
(9490, 180, 'Cable Connector Dinse Type Male 95mm ', 104.27, 34, '0.00', 208.53, 68, 0, 2, 10.2),
(9491, 180, 'able Connector Dinse Type Female 50-70', 73.6, 24, '0.00', 147.2, 48, 0, 2, 7.2),
(9492, 180, 'Cable Connector Dinse Type Female 95mm', 104.27, 34, '0.00', 208.53, 68, 0, 2, 10.2),
(9493, 180, 'MACHINE PANEL SOCKET FEM LUG TYPE 10-25', 29.13, 4.75, '0.00', 29.13, 19, 0, 1, 2.85),
(9494, 180, 'MACHINE PANEL SOCKET FEM LUG TYPE 35-50 ', 65.93, 10.75, '0.00', 65.93, 43, 0, 1, 6.45),
(9489, 180, 'Cable Connector Dinse Type Male 50-70 ', 73.6, 24, '0.00', 147.2, 48, 0, 2, 7.2),
(9488, 180, 'Cable Connector Dinse Type Male 35-50', 67.47, 22, '0.00', 134.93, 44, 0, 2, 6.6),
(9482, 180, 'Angle Grinder 900W 115mm Metabo QUICK', 2418.99, 394.4, '0.00', 2418.99, 1577.6, 0, 1, 236.64),
(9487, 180, 'Cable Connector Dinse Type Male 10-25 ', 29.13, 9.5, '0.00', 58.27, 19, 0, 2, 2.85),
(9486, 180, '7018-1 3.2MM VACUUM PACK per kg', 70.53, 57.5, '0.00', 352.67, 46, 0, 5, 6.9),
(9485, 180, 'PIONEER E6013 - 3.2mm Per kg', 46, 37.5, '0.00', 230, 30, 0, 5, 4.5),
(9484, 180, ' E6013 - 2.5mm 5kg Price per KG', 46, 37.5, '0.00', 230, 30, 0, 5, 4.5),
(9483, 180, 'Broom platform 450mm SOFT - BLACK', 139.53, 22.75, '0.00', 139.53, 91, 0, 1, 13.65),
(9481, 180, 'ROPE SKI MTS PP 10MM X10M', 64.08, 10.4475, '0.00', 64.08, 41.79, 0, 1, 6.2685),
(9480, 180, 'Matweld Tig Torch Body C/W Handle 26V ', 315.25, 51.4, '0.00', 315.25, 205.6, 0, 1, 30.84),
(9479, 180, 'MB36 Mig Torch S-Type 4m ', 2422.67, 395, '0.00', 2422.67, 1580, 0, 1, 237),
(9478, 180, 'MB40 Mig Torch  S-Type 4m', 3020.67, 492.5, '0.00', 3020.67, 1970, 0, 1, 295.5),
(9477, 180, 'Flash Back Arrestor (Oxygen Torch) ', 171.73, 28, '0.00', 171.73, 112, 0, 1, 16.8),
(9476, 180, 'Flash Back Arrestor (Oxygen Regulator)', 171.73, 28, '0.00', 171.73, 112, 0, 1, 16.8),
(9475, 180, 'Flash Back Arrestor (Acetylene Torch) ', 171.73, 28, '0.00', 171.73, 112, 0, 1, 16.8),
(9473, 180, 'Anti Spatter (Silicone /Silicone Free) 300ml ', 73.6, 12, '0.00', 73.6, 48, 0, 1, 7.2),
(9474, 180, 'Flash Back Arrestor (Acetylene Regulator ', 171.73, 28, '0.00', 171.73, 112, 0, 1, 16.8),
(9472, 180, 'Q20 moisture repellent 300gr ', 122.67, 20, '0.00', 122.67, 80, 0, 1, 12),
(9471, 180, 'LECTRO KLEEN SPRAY 400ML - SPANJAARD', 180.32, 29.4, '0.00', 180.32, 117.6, 0, 1, 17.64),
(9470, 180, 'SHROUD BNZ 36 CONICAL', 72.07, 11.75, '0.00', 72.07, 47, 0, 1, 7.05),
(9469, 180, 'CHIPPING HAMMER ', 55.2, 9, '0.00', 55.2, 36, 0, 1, 5.4),
(9468, 180, 'WHITE METAL MARKER PEN ', 25.3, 4.125, '0.00', 25.3, 16.5, 0, 1, 2.475),
(9467, 180, 'WELDING LENS 108 X 51 Clear', 3.56, 0.58, '0.00', 3.56, 2.32, 0, 1, 0.348),
(9466, 180, 'WELDING LENS 108 X 51 SHADE 12', 4.45, 0.725, '0.00', 4.45, 2.9, 0, 1, 0.435),
(9465, 180, 'WELDING LENS 108 X 51 SHADE 10', 4.45, 0.725, '0.00', 4.45, 2.9, 0, 1, 0.435),
(9464, 180, 'WELDING LENS 108 X 51 SHADE 8', 4.45, 0.725, '0.00', 4.45, 2.9, 0, 1, 0.435),
(9463, 180, 'Collet Body 10N32 2.4mm ', 21.93, 35.75, '0.00', 219.27, 14.3, 0, 10, 2.145),
(9462, 180, 'Collets 10N24 2.4mm ', 11.27, 18.375, '0.00', 112.7, 7.35, 0, 10, 1.1025),
(9461, 180, 'Tungsten 0.8% Ziconiated White Tip 2.4mm', 46, 75, '0.00', 460, 30, 0, 10, 4.5),
(9460, 180, 'Replacement For Triple Flint Lighter ', 9.08, 1.48, '0.00', 9.08, 5.92, 0, 1, 0.888),
(9456, 180, 'Gas Diffuser MB40', 7.59, 12.375, '0.00', 75.9, 4.95, 0, 10, 0.7425),
(9457, 180, 'Developer 325ml ', 88.93, 14.5, '0.00', 88.93, 58, 0, 1, 8.7),
(9459, 180, 'Triple Flint Lighter', 47.53, 15.5, '0.00', 95.07, 31, 0, 2, 4.65),
(9458, 180, 'Nozzle Cleaner', 41.86, 6.825, '0.00', 41.86, 27.3, 0, 1, 4.095),
(9455, 180, 'Tip Adaptor MB40xM8 ', 19.93, 3.25, '0.00', 19.93, 13, 0, 1, 1.95),
(9454, 180, 'Gas Diffuser MB36 ', 7.59, 1.2375, '0.00', 7.59, 4.95, 0, 1, 0.7425),
(9453, 180, 'Tip Adaptor MB36xM8 ', 19.44, 3.17, '0.00', 19.44, 12.68, 0, 1, 1.902),
(9452, 180, 'Tip Adaptor MB36xM6 ', 13.31, 2.17, '0.00', 13.31, 8.68, 0, 1, 1.302),
(9451, 180, 'Cutting Nozzle ANME 2.4mm 3/32', 110.4, 18, '0.00', 110.4, 72, 0, 1, 10.8),
(9450, 180, 'Cutting Nozzle ANME 2.0mm 5/64 ', 110.4, 18, '0.00', 110.4, 72, 0, 1, 10.8),
(9449, 180, 'Cutting Nozzle ANME 1.6mm 1/16', 110.4, 18, '0.00', 110.4, 72, 0, 1, 10.8),
(9448, 180, 'Cutting Nozzle ANME 1.2mm 3/64', 110.4, 18, '0.00', 110.4, 72, 0, 1, 10.8),
(9447, 180, 'Cutting Nozzle ANME 0.8mm 1/32 ', 110.4, 18, '0.00', 110.4, 72, 0, 1, 10.8),
(9446, 180, 'Chalk Reel + Powder set', 82.8, 13.5, '0.00', 82.8, 54, 0, 1, 8.1),
(9445, 180, 'Chalk Boiler Marker', 4, 0.6525, '0.00', 4, 2.61, 0, 1, 0.3915),
(9444, 180, 'Hacksaw Blade Eclipse 24 Teeth', 15.33, 2.5, '0.00', 15.33, 10, 0, 1, 1.5),
(9443, 180, 'Dromex Spectacle SPORT Style Clear', 12.13, 1.9775, '0.00', 12.13, 7.91, 0, 1, 1.1865),
(9442, 180, 'Dromex VIP TIG Glove Chrome leather', 38.12, 6.215, '0.00', 38.12, 24.86, 0, 1, 3.729),
(9441, 180, 'Dromex Chrome leather double palm elbow length 8', 46.89, 7.645, '0.00', 46.89, 30.58, 0, 1, 4.587),
(9440, 180, 'FFP1 Dust Mask SABS Approved', 3.99, 0.65, '0.00', 3.99, 2.6, 0, 1, 0.39),
(9439, 180, 'Dromex Ear Plug Tri Flange, Reusable DR118C', 3.37, 0.55, '0.00', 3.37, 2.2, 0, 1, 0.33),
(9438, 180, 'Domex Spectacle (Wrap Around) green', 14.8, 2.4125, '0.00', 14.8, 9.65, 0, 1, 1.4475),
(9436, 180, 'Dromex Spectacle SPORT Style Green', 12.13, 1.9775, '0.00', 12.13, 7.91, 0, 1, 1.1865),
(9437, 180, 'Dromex Spectacle (Wrap Around) Clear', 14.8, 2.4125, '0.00', 14.8, 9.65, 0, 1, 1.4475),
(9423, 180, 'PVC Rubberised Rain Coat Navy M-3XL', 118.07, 19.25, '0.00', 118.07, 77, 0, 1, 11.55),
(9424, 180, 'Safety Hard Cap ALL Colours', 21.39, 3.4875, '0.00', 21.39, 13.95, 0, 1, 2.0925),
(9425, 180, 'Lime Reflective Vest with Zip & ID S-4XL', 37.44, 6.105, '0.00', 37.44, 24.42, 0, 1, 3.663),
(9426, 180, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 179.4, 29.25, '0.00', 179.4, 117, 0, 1, 17.55),
(9427, 180, 'Chrome Leather Welding Apron 1 piece  60x 120', 152.41, 24.85, '0.00', 152.41, 99.4, 0, 1, 14.91),
(9428, 180, 'Chrome Leather Yoke L-2XL', 228.22, 37.21, '0.00', 228.22, 148.84, 0, 1, 22.326),
(9429, 180, 'Chrome Leather Yoke 3XL-4XL', 270.33, 44.075, '0.00', 270.33, 176.3, 0, 1, 26.445),
(9430, 180, 'Chrome Leather Ankle Spats', 52.75, 8.6, '0.00', 52.75, 34.4, 0, 1, 5.16),
(9431, 180, 'Flip front Welding helmet Standard', 65.93, 10.75, '0.00', 65.93, 43, 0, 1, 6.45),
(9432, 180, 'Face Shield clear complete', 45.85, 7.475, '0.00', 45.85, 29.9, 0, 1, 4.485),
(9433, 180, 'PVC Red smooth shoulder glove  (Acid 16Inch)', 59.8, 9.75, '0.00', 59.8, 39, 0, 1, 5.85),
(9434, 180, 'Dromex Spectacle EURO Clear adjustable Frame', 13.91, 2.2675, '0.00', 13.91, 9.07, 0, 1, 1.3605),
(9435, 180, 'Dromex Spectacle EURO Green adjustable Frame', 13.91, 2.2675, '0.00', 13.91, 9.07, 0, 1, 1.3605),
(9422, 180, 'Dromex PVC Rubberised Rain Suit Navy S- 4XL', 149.06, 24.3025, '0.00', 149.06, 97.21, 0, 1, 14.5815),
(9421, 180, 'Dromex Kidney Belt size S -2XL', 105.19, 17.15, '0.00', 105.19, 68.6, 0, 1, 10.29),
(9420, 180, 'Dromex Kidney Belt size L', 105.19, 17.15, '0.00', 105.19, 68.6, 0, 1, 10.29),
(9419, 180, 'Dromex Kidney Belt size M', 105.19, 17.15, '0.00', 105.19, 68.6, 0, 1, 10.29),
(9418, 180, 'Dromex Kidney Belt size S ', 105.19, 17.15, '0.00', 105.19, 68.6, 0, 1, 10.29),
(9416, 180, 'Maxi View goggle, anti scratch, anti fog', 56.73, 9.25, '0.00', 56.73, 37, 0, 1, 5.55),
(9417, 180, 'D59 Welding skull cap', 90.47, 14.75, '0.00', 90.47, 59, 0, 1, 8.85),
(9415, 180, 'Green lined glove Shoulder length 16', 145.05, 23.65, '0.00', 145.05, 94.6, 0, 1, 14.19),
(9414, 180, 'Green lined glove elbow length 8', 73.09, 11.9175, '0.00', 73.09, 47.67, 0, 1, 7.1505),
(9413, 180, 'Green lined glove wrist length 2.5', 55.35, 9.025, '0.00', 55.35, 36.1, 0, 1, 5.415),
(9512, 180, 'Insulation Tape Nitto 18x20m Blue', 41.71, 6.8, '0.00', 41.71, 27.2, 0, 1, 4.08),
(9513, 180, 'Matewld Tig Cup Gasket All Torch Front ', 18.4, 3, '0.00', 18.4, 12, 0, 1, 1.8),
(9563, 181, 'Rebel Kontrakta Boot size 10', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(9562, 181, 'Rebel Kontrakta Boot size 9', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(9561, 181, 'Rebel Kontrakta Boot size 7', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(9560, 181, 'Rebel Kontrakta Boot size 6', 502.78, 163.95, '0.00', 1005.56, 327.9, 0, 2, 49.185),
(9559, 181, 'D59 Flame Retardant & Acid Resist Jacket Size  44', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9558, 181, 'D59 Flame Retardant & Acid Resist Jacket Size 42', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9557, 181, 'D59 Flame Retardant & Acid Resist Jacket Size 40', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9556, 181, 'D59 Flame Retardant & Acid Resist Jacket Size 38', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9555, 181, 'D59 Flame Retardant & Acid Resist Jacket Size 36', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9554, 181, 'D59 Flame Retardant & Acid Resist Jacket Size 32', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9553, 181, 'D59 Flame Retardant & Acid Resist Trouser Size 40', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9552, 181, 'D59 Flame Retardant & Acid Resist Trouser Size 38', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9551, 181, 'D59 Flame Retardant & Acid Resist Trouser Size 36', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9550, 181, 'D59 Flame Retardant & Acid Resist Trouser Size 34', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9549, 181, 'D59 Flame Retardant & Acid Resist Trouser Size 32', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9548, 181, 'D59 Flame Retardant & Acid Resist Trouser Size 28', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(9564, 181, 'Rebel Kontrakta Boot size 11', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(10680, 182, 'Black Disinfectant 5lt', 117.3, 19.125, '0.00', 117.3, 76.5, 0, 1, 11.475),
(10679, 182, 'Safety Hard Cap Blue', 21.39, 17.4375, '0.00', 106.95, 13.95, 0, 5, 2.0925),
(10678, 182, 'ACE Leather welders apron ,60 x 90cm, ONE PIECE', 123.02, 100.2875, '0.00', 615.1, 80.23, 0, 5, 12.0345),
(10673, 182, 'Red heat resistant apron palm welding glove,', 83.72, 327.6, '0.00', 2009.28, 54.6, 0, 24, 8.19),
(10674, 182, 'Rags/kg', 22.69, 185, '0.00', 1134.67, 14.8, 0, 50, 2.22),
(10675, 182, 'Dromex Cotton Glove ', 4.92, 160.5, '0.00', 984.4, 3.21, 0, 200, 0.4815),
(10676, 182, 'Dromex Rough Palm, Rolled Cuff, Shoulder 55cm length (Chemical)', 61.52, 120.36, '0.00', 738.21, 40.12, 0, 12, 6.018),
(10677, 182, 'Chrome Leather Welding Apron 1 piece  60x 120', 152.41, 124.25, '0.00', 762.07, 99.4, 0, 5, 14.91),
(10672, 182, 'Blue lined  welding glove,elbow length 8', 83.72, 163.8, '0.00', 1004.64, 54.6, 0, 12, 8.19),
(10671, 182, 'FFP1 Dust Mask SABS Approved', 3.68, 180, '0.00', 1104, 2.4, 0, 300, 0.36),
(10666, 182, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 179.4, 117, '0.00', 717.6, 117, 0, 4, 17.55),
(10670, 182, 'Chrome Leather Yoke 2XL', 228.22, 111.63, '0.00', 684.66, 148.84, 0, 3, 22.326),
(10669, 182, 'Toilet Paper Virgin 2 ply 48\'s', 260.67, 127.5, '0.00', 782, 170, 0, 3, 25.5),
(10668, 182, 'Dromex Spectacle EURO Clear adjustable Frame', 13.91, 27.21, '0.00', 166.89, 9.07, 0, 12, 1.3605),
(10667, 182, 'Green PVC Apron Heavy Duty 400gm', 39.87, 32.5, '0.00', 199.33, 26, 0, 5, 3.9),
(9663, 183, 'PVC Red smooth shoulder glove ', 67.01, 131.1, '0.00', 804.08, 43.7, 0, 12, 6.555),
(9707, 184, 'DROMEX BOXER BLACK SAFETY BOOT Size 10', 329.85, 107.56, '0.00', 659.7, 215.12, 0, 2, 32.268),
(9706, 184, 'DROMEX BOXER BLACK SAFETY BOOT Size 9', 329.85, 268.9, '0.00', 1649.25, 215.12, 0, 5, 32.268),
(9705, 184, 'DROMEX BOXER BLACK SAFETY BOOT Size 8', 329.85, 484.02, '0.00', 2968.66, 215.12, 0, 9, 32.268),
(9704, 184, 'DROMEX BOXER BLACK SAFETY BOOT Size 7', 329.85, 215.12, '0.00', 1319.4, 215.12, 0, 4, 32.268),
(9703, 184, 'DROMEX BOXER BLACK SAFETY BOOT Size 6', 329.85, 484.02, '0.00', 2968.66, 215.12, 0, 9, 32.268),
(9702, 184, 'DROMEX BOXER BLACK SAFETY BOOT Size 5', 329.85, 107.56, '0.00', 659.7, 215.12, 0, 2, 32.268),
(9701, 184, 'DROMEX BOXER BLACK SAFETY BOOT Size 4', 329.85, 215.12, '0.00', 1319.4, 215.12, 0, 4, 32.268),
(9751, 185, 'Barron Mens Brushed Cotton Twill Lounge short sleeve Black S-5XL', 443.13, 650.25, '0.00', 3988.2, 289, 0, 9, 43.35),
(9753, 185, 'Embroidery - FABCON STEEL ', 26.07, 63.75, '0.00', 391, 17, 0, 15, 2.55),
(9739, 186, 'Lameitre Clog - STC slip-on - 8009 (UPDATE) Size 10', 766.67, 125, '0.00', 766.67, 500, 0, 1, 75),
(9738, 186, 'Bova Shoe - Multi  Size 9', 613.33, 200, '0.00', 1226.67, 400, 0, 2, 60),
(9737, 186, 'Bova Shoe - Multi  Size 8', 613.33, 100, '0.00', 613.33, 400, 0, 1, 60),
(9735, 186, 'Bova Boot - Welders Size 11', 1395.33, 227.5, '0.00', 1395.33, 910, 0, 1, 136.5),
(9736, 186, 'Bova Shoe - Multi  Size 7', 613.33, 200, '0.00', 1226.67, 400, 0, 2, 60),
(9734, 186, 'Bova Boot - Welders Size 10', 1395.33, 227.5, '0.00', 1395.33, 910, 0, 1, 136.5),
(9733, 186, 'Bova Boot - Welders Size 9', 1395.33, 910, '0.00', 5581.33, 910, 0, 4, 136.5),
(9732, 186, 'Bova Boot - Welders Size 8', 1395.33, 227.5, '0.00', 1395.33, 910, 0, 1, 136.5),
(9741, 187, 'Rebel Boot - FX2-MT-S1-P Metatarsal (Welding) Alternative', 952.81, 155.35, '0.00', 952.81, 621.4, 0, 1, 93.21),
(9752, 185, 'Barron Mens Brushed Cotton Twill Lounge short sleeve Navy S-5XL', 443.13, 433.5, '0.00', 2658.8, 289, 0, 6, 43.35),
(9819, 188, 'FFP2 Dust Mask SABS Approved 20 / Box. Price for each', 4.14, 67.5, '0.00', 414, 2.7, 0, 100, 0.405),
(10013, 190, 'MEDIC - DENT GLOVES BLUE', 127.27, 20.75, '0.00', 127.27, 83, 0, 1, 12.45),
(9817, 188, 'Dromex Spectacle EURO Grey adjustable Frame', 13.91, 45.35, '0.00', 278.15, 9.07, 0, 20, 1.3605),
(9818, 188, 'Dromex Spectacle EURO Clear adjustable Frame', 13.91, 113.375, '0.00', 695.37, 9.07, 0, 50, 1.3605),
(9814, 189, 'Safety harnesses with double lanyard & scaffold hooks with belt', 736, 1800, '0.00', 11040, 480, 0, 15, 72),
(9815, 188, 'Dromex COMAREX, yellow latex fully dipped glove, knit cuff', 25.51, 416, '0.00', 2551.47, 16.64, 0, 100, 2.496),
(9816, 188, 'Fingersaver 350mm', 1380, 450, '0.00', 2760, 900, 0, 2, 135),
(10009, 190, 'Beard Cover White /100', 56.73, 9.25, '0.00', 56.73, 37, 0, 1, 5.55),
(10010, 190, 'GREEN-DISPOSABLE APRONS(100/PACK)', 47.99, 7.825, '0.00', 47.99, 31.3, 0, 1, 4.695),
(10011, 190, 'WHITE-DISPOSABLE APRONS(100/PACK)', 47.99, 7.825, '0.00', 47.99, 31.3, 0, 1, 4.695),
(10012, 190, 'BLUE-DISPOSABLE APRONS(100/PACK)', 47.99, 7.825, '0.00', 47.99, 31.3, 0, 1, 4.695),
(10008, 190, 'PLASTIC SLEEVE PROTECTORS-BLUE (100/PACK)', 36.03, 5.875, '0.00', 36.03, 23.5, 0, 1, 3.525),
(10007, 190, 'PLASTIC SLEEVE PROTECTORS-YELOW (100/PACK)', 36.03, 1175, '0.00', 7206.67, 23.5, 0, 200, 3.525),
(10004, 190, 'Golden Hands Examination Nitrile Gloves Blue/ Box (Medi-Dent Equivalent)', 78.2, 12.75, '0.00', 78.2, 51, 0, 1, 7.65),
(10006, 190, 'PLASTIC SLEEVE PROTECTORS-RED(100/PACK)', 36.03, 5.875, '0.00', 36.03, 23.5, 0, 1, 3.525),
(10005, 190, 'DROMEX RE-USEABLE DETECTABLE BLUE PLUG AND CORD (200/BOX)', 6.23, 1.015, '0.00', 6.23, 4.06, 0, 1, 0.609),
(10003, 190, 'Disposable Shoe Cover / 100', 82.65, 13.475, '0.00', 82.65, 53.9, 0, 1, 8.085),
(10002, 190, 'MOP CAPS-RED 21 INCH DOUBLE ELASTIC', 40.79, 6.65, '0.00', 40.79, 26.6, 0, 1, 3.99),
(10001, 190, 'MOP CAPS-YELLOW 21 INCH DOUBLE ELASTIC', 40.79, 6.65, '0.00', 40.79, 26.6, 0, 1, 3.99),
(10000, 190, 'MOP CAPS-PINK 21 INCH DOUBLE ELASTIC', 40.79, 6.65, '0.00', 40.79, 26.6, 0, 1, 3.99),
(9999, 190, 'MOP CAPS-GREEN 21  INCH DOUBLE ELASTIC', 40.79, 6.65, '0.00', 40.79, 26.6, 0, 1, 3.99),
(9998, 190, 'MOP CAPS-BLUE 21  INCH DOUBLE ELASTIC', 40.79, 6.65, '0.00', 40.79, 26.6, 0, 1, 3.99),
(9949, 191, 'Dromex Cut Resistatnd Glove Level 5', 48.94, 191.5200000000001, '0.00', 1174.66, 31.92, 0, 24, 4.788),
(9945, 191, 'PVC Rubberised Rain Coat Navy  or Yellow S', 115, 37.5, '0.00', 230, 75, 0, 2, 11.25),
(9948, 191, 'PVC Rubberised Rain Coat Navy  or Yellow XL', 115, 37.5, '0.00', 230, 75, 0, 2, 11.25),
(9947, 191, 'PVC Rubberised Rain Coat Navy  or Yellow  L', 115, 56.25, '0.00', 345, 75, 0, 3, 11.25),
(9946, 191, 'PVC Rubberised Rain Coat Navy  or Yellow M', 115, 37.5, '0.00', 230, 75, 0, 2, 11.25),
(10229, 192, 'CONE; SAFETY; TRAFFIC; NAVY; BLUE; 1.8M; C/W DBL REFLEC; TAPE ', 651.67, 106.25, '0.00', 651.67, 425, 0, 1, 63.75),
(10228, 192, 'CONE; SAFETY; TRAFFIC; ORANGE; 1800MM C/W DBL REFLEC; TAPES ', 651.67, 106.25, '0.00', 651.67, 425, 0, 1, 63.75),
(10227, 192, 'CONE; SAFETY; TRAFFIC; PURPLE; 1.8M; C/W DBL; REFLEC TAPE; SUN000 ', 651.67, 106.25, '0.00', 651.67, 425, 0, 1, 63.75),
(10225, 192, 'CONE; SAFETY; TRAFFIC; YELLOW; 1.8M; C/W DBL; REFLEC TAPE; 2024MSXS047 ', 651.67, 106.25, '0.00', 651.67, 425, 0, 1, 63.75),
(10226, 192, 'CONE; SAFETY; TRAFFIC; 1.8M; LIME GREEN; CW DBLE REFLEC; TAPE; 4200MSXS047G ', 651.67, 106.25, '0.00', 651.67, 425, 0, 1, 63.75),
(10223, 192, 'CONE; SAFETY; TRAFFIC; ORANGE; 1000MM X 490MM SQ BASE  ', 398.67, 65, '0.00', 398.67, 260, 0, 1, 39),
(10224, 192, 'CONE; SAFETY; TRAFFIC; RED; 1.8M; C/W DBL REFLEC TAPE; 2333MSXS047R', 651.67, 106.25, '0.00', 651.67, 425, 0, 1, 63.75),
(10219, 192, 'CONE; SAFETY; TRAFFIC; ORANGE; 450MM X 240MM; SQ BASE  ', 176.33, 28.75, '0.00', 176.33, 115, 0, 1, 17.25),
(10220, 192, 'CONE SAFETY; TRAFFICE BLUE; 28IN 7 LB; W/6IN & 4IN; 3M; REFLEC COLLAR ', 398.67, 65, '0.00', 398.67, 260, 0, 1, 39),
(10221, 192, 'CONE SAFETY; TRAFFIC ORANGE; 750MM C/W DBL REFLEC TAPES  ', 337.33, 55, '0.00', 337.33, 220, 0, 1, 33),
(10222, 192, 'CONE; SAFETY; TRAFFIC; BLUE; 750MM C/W DBL REFLEC STRIPS; 3M COLLAR TAPES ', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(10218, 192, 'CONE; SAFETY; TRAFFIC; LIME; GRN 750MM C/W DBL REFLEC TAPES  ', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(10217, 192, 'Flagging Tape 25mm LDPE 70 Micron - Orange', 28.09, 45.8, '0.00', 280.91, 18.32, 0, 10, 2.748),
(10216, 192, 'Flagging Tape 25mm LDPE 70 Micron - Pink', 28.09, 45.8, '0.00', 280.91, 18.32, 0, 10, 2.748),
(10215, 192, 'Flagging Tape 25mm LDPE 70 Micron - Yellow', 28.09, 45.8, '0.00', 280.91, 18.32, 0, 10, 2.748),
(10214, 192, 'Flagging Tape  25mmLDPE 70 Micron - Green', 28.09, 45.8, '0.00', 280.91, 18.32, 0, 10, 2.748),
(10213, 192, 'Flagging Tape 25mm LDPE 70 Micron - Blue', 28.09, 45.8, '0.00', 280.91, 18.32, 0, 10, 2.748),
(10212, 192, 'Flagging Tape 25mm LDPE 70 Micron - Red', 28.09, 45.8, '0.00', 280.91, 18.32, 0, 10, 2.748),
(10211, 192, 'Flagging Tape 25mm LDPE 70 Micron - White', 28.09, 45.8, '0.00', 280.91, 18.32, 0, 10, 2.748),
(10210, 192, 'Barrier Tape 75 x 500 Red/white', 116.53, 95, '0.00', 582.67, 76, 0, 5, 11.4),
(10297, 193, 'Sebedisano Logo Embroidery Front Left Chest', 26.07, 17, '0.00', 104.27, 17, 0, 4, 2.55),
(10293, 193, 'Navy Blue Freezer Jacket M', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(10296, 193, 'Navy Blue Freezer Jacket  2XL', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(10295, 193, 'Navy Blue Freezer Jacket XL', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(10294, 193, 'Navy Blue Freezer Jacket L', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(10897, 194, 'Wire Nails 75mm / kg', 47.53, 23.25, '0.00', 142.6, 31, 0, 3, 4.65),
(10896, 194, 'Ear Muff', 27.6, 22.5, '0.00', 138, 18, 0, 5, 2.7),
(10895, 194, 'GAS CARTRIDGE 190gr PLUMB', 47.53, 46.5, '0.00', 285.2, 31, 0, 6, 4.65),
(10893, 194, 'Citronol Hand Cleaner with grit 30 Kg', 810.01, 132.0675, '0.00', 810.01, 528.27, 0, 1, 79.2405),
(10894, 194, 'DROMEX EVOR VISOR CARRIER for hard hat with INTEREX', 115.89, 188.95, '0.00', 1158.89, 75.58, 0, 10, 11.337),
(10630, 195, 'Logo Embroidery Front Left Chest', 27.6, 27, '0.00', 165.6, 18, 0, 6, 2.7),
(10629, 195, 'Zee Lodge Logo Digitizing (Once off)', 383.33, 62.5, '0.00', 383.33, 250, 0, 1, 37.5),
(10628, 195, 'DROMEX 2 TONE PUFFER JACCKET Olive/Black ', 668.61, 109.0125, '0.00', 668.61, 436.05, 0, 1, 65.4075),
(10450, 125, 'Rebel Kontrakta Boot size 11', 502.78, 81.975, '0.00', 502.78, 327.9, 0, 1, 49.185),
(10625, 195, 'DROMEX Navy CONTI SUIT with Reflective, sizes 30 Pants- 34 Jacket (Set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(10626, 195, 'DROMEX Navy CONTI SUIT with Reflective, sizes 32Pants- 36 Jacket (Set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(10627, 195, 'DROMEX Navy CONTI SUIT with Reflective, sizes 36 Pants- 40 Jacket( set)', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(10622, 195, 'ROXIE LADYS SAFETY SHOE SIZE 6 (Dorah)', 444.67, 72.5, '0.00', 444.67, 290, 0, 1, 43.5),
(10620, 195, 'Lady\'s Canteen Coat short sleeve size S-4XL (Available in royal blue or Green)', 107.33, 35, '0.00', 214.67, 70, 0, 2, 10.5),
(10624, 195, 'DROMEX BOXER BLACK SAFETY BOOT Size 10', 329.85, 107.56, '0.00', 659.7, 215.12, 0, 2, 32.268),
(10623, 195, 'DROMEX BOXER BLACK SAFETY BOOT Size 7', 329.85, 53.78, '0.00', 329.85, 215.12, 0, 1, 32.268),
(10447, 125, 'D59 Flame Retardant & Acid Resist Trouser Size 44', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(10448, 125, 'D59 Flame Retardant & Acid Resist Trouser Size 46', 304.26, 49.608125, '0.00', 304.26, 198.4325, 0, 1, 29.764875),
(10621, 195, 'ROXIE LADYS SAFETY SHOE SIZE 5 (Mavis)', 444.67, 72.5, '0.00', 444.67, 290, 0, 1, 43.5),
(10659, 196, 'Navy Blue Freezer Jacket L', 360.33, 117.5, '0.00', 720.67, 235, 0, 2, 35.25),
(10658, 196, 'Navy Blue Freezer Jacket M', 360.33, 117.5, '0.00', 720.67, 235, 0, 2, 35.25),
(10657, 196, 'Sebedisano Logo Embroided Front Left Chest', 26.07, 17, '0.00', 104.27, 17, 0, 4, 2.55),
(10656, 196, 'D59 Flame Retardant & Acid Resist Jacket Size 46', 304.26, 49.608125, '0.00', 304.26, 198.4325, 0, 1, 29.764875),
(10655, 196, 'D59 Flame Retardant & Acid Resist Jacket Size 44', 277.28, 45.209375, '0.00', 277.28, 180.8375, 0, 1, 27.125625),
(10654, 196, 'D59 Flame Retardant & Acid Resist Jacket Size 36', 277.28, 90.41875, '0.00', 554.57, 180.8375, 0, 2, 27.125625),
(10660, 196, 'Navy Blue Freezer Jacket XL', 360.33, 58.75, '0.00', 360.33, 235, 0, 1, 35.25),
(10692, 197, 'Barron Beckham Hooded Sweater Charcoal Heather M', 413.98, 67.4975, '0.00', 413.98, 269.99, 0, 1, 40.4985),
(10691, 197, 'Barron Techno Jacket Ladies LAR Steel Grey 2XL', 965.98, 157.4975, '0.00', 965.98, 629.99, 0, 1, 94.4985),
(10690, 197, 'Barron Techno Jacket Ladies LAR Steel Grey M', 965.98, 157.4975, '0.00', 965.98, 629.99, 0, 1, 94.4985),
(10689, 197, 'Barron Techno Jacket Mens 2XL Steel Grey L', 965.98, 157.4975, '0.00', 965.98, 629.99, 0, 1, 94.4985),
(10917, 199, 'Ear Muff', 27.6, 13.5, '0.00', 82.8, 18, 0, 3, 2.7),
(10885, 198, 'Dromex Pique Knit Golfer Navy - L', 103.91, 169.425, '0.00', 1039.14, 67.77, 0, 10, 10.1655),
(10886, 198, 'Dromex Pique Knit Golfer Navy - XL', 103.91, 135.54, '0.00', 831.31, 67.77, 0, 8, 10.1655),
(10887, 198, 'Security Web Belt', 70.53, 161, '0.00', 987.47, 46, 0, 14, 6.9),
(10884, 198, 'Dromex Pique Knit Golfer Navy - M', 103.91, 169.425, '0.00', 1039.14, 67.77, 0, 10, 10.1655),
(10883, 198, 'Barron 6 Panel  Cap Navy', 38.32, 87.465, '0.00', 536.45, 24.99, 0, 14, 3.7485),
(10882, 198, 'Canvas Combat Boot Black Size 11', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(10881, 198, 'Canvas Combat Boot Black Size 10', 299, 195, '0.00', 1196, 195, 0, 4, 29.25),
(10880, 198, 'Canvas Combat Boot Black Size 9', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(10879, 198, 'Canvas Combat Boot Black Size 8 ', 299, 243.75, '0.00', 1495, 195, 0, 5, 29.25),
(10878, 198, 'Canvas Combat Boot Black Size 7', 299, 97.5, '0.00', 598, 195, 0, 2, 29.25),
(10877, 198, 'Canvas Combat Boot Black Size 6 ', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(10876, 198, 'Security Jacket Navy - XL', 475.32, 309.99, '0.00', 1901.27, 309.99, 0, 4, 46.4985),
(10875, 198, 'Security Jacket Navy - L', 444.65, 362.4875, '0.00', 2223.26, 289.99, 0, 5, 43.4985),
(10874, 198, 'Security Jacket Navy - M', 444.65, 362.4875, '0.00', 2223.26, 289.99, 0, 5, 43.4985),
(10873, 198, 'Combat Trouser Navy – 44', 130.33, 42.5, '0.00', 260.67, 85, 0, 2, 12.75),
(10872, 198, 'Combat Trouser Navy – 42', 130.33, 42.5, '0.00', 260.67, 85, 0, 2, 12.75),
(10871, 198, 'Combat Trouser Navy – 38', 130.33, 85, '0.00', 521.33, 85, 0, 4, 12.75),
(10870, 198, 'Combat Trouser Navy – 36', 130.33, 212.5, '0.00', 1303.33, 85, 0, 10, 12.75),
(10869, 198, 'Combat Trouser Navy– 34', 130.33, 42.5, '0.00', 260.67, 85, 0, 2, 12.75),
(10868, 198, 'Combat Trouser Navy – 32', 130.33, 170, '0.00', 1042.67, 85, 0, 8, 12.75),
(10865, 198, 'Combat Shirt Navy – M', 130.33, 106.25, '0.00', 651.67, 85, 0, 5, 12.75),
(10866, 198, 'Combat Shirt Navy – L', 130.33, 106.25, '0.00', 651.67, 85, 0, 5, 12.75),
(10867, 198, 'Combat Shirt Navy – XL', 130.33, 85, '0.00', 521.33, 85, 0, 4, 12.75),
(10916, 199, 'FFP2 Dust Mask SABS Approved', 4.45, 14.5, '0.00', 88.93, 2.9, 0, 20, 0.435),
(10915, 199, 'FFP1 Dust Mask SABS Approved', 4.37, 14.25, '0.00', 87.4, 2.85, 0, 20, 0.4275),
(10914, 199, 'Dromex Spectacle EURO Clear adjustable Frame', 13.91, 13.605, '0.00', 83.44, 9.07, 0, 6, 1.3605),
(10942, 200, 'Canyon Jacket Men L Granite', 611.8, 99.75, '0.00', 611.8, 399, 0, 1, 59.85),
(10938, 200, '200g Pique Knit Golfer Ladies M Black', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(10939, 200, '200g Pique Knit Golfer Ladies 2XL Black', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(10940, 200, 'Canyon Jacket Ladies M Black', 611.8, 99.75, '0.00', 611.8, 399, 0, 1, 59.85),
(10941, 200, 'Canyon Jacket Ladies 2XL  Granite', 611.8, 99.75, '0.00', 611.8, 399, 0, 1, 59.85),
(14832, 201, 'Embroidery Left Chest', 26.67, 30, '0.00', 160, 20, 0, 6, 0),
(14831, 201, 'TMT Logo Digitizing (Once off)', 373.33, 70, '0.00', 373.33, 280, 0, 1, 0),
(14830, 201, 'Dromex Bunny Jacket Navy L', 666.67, 375, '0.00', 2000, 500, 0, 3, 0),
(14829, 201, 'Dromex Bunny Jacket Navy S ', 666.67, 375, '0.00', 2000, 500, 0, 3, 0),
(11018, 202, 'GAS CARTRIDGE 190gr PLUMB ', 47.53, 46.5, '0.00', 285.2, 31, 0, 6, 4.65),
(11016, 202, 'Rags Super Absorbent per kg', 21.77, 88.75, '0.00', 544.33, 14.2, 0, 25, 2.13),
(11017, 202, 'Dromex Yellow household Glove with Flock Liner', 9.41, 18.42, '0.00', 112.98, 6.14, 0, 12, 0.921),
(11015, 202, 'Dromex Spectacle EURO Green adjustable Frame', 13.91, 27.21, '0.00', 166.89, 9.07, 0, 12, 1.3605),
(11011, 202, 'Dromex Chrome leather double palm  wrist length 2.5', 37.44, 12.21, '0.00', 74.89, 24.42, 0, 2, 3.663),
(11012, 202, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 179.4, 117, '0.00', 717.6, 117, 0, 4, 17.55),
(11013, 202, 'Dromex Chrome leather double palm  wrist length 2.5', 38.33, 150, '0.00', 920, 25, 0, 24, 3.75),
(11014, 202, 'Blue lined  welding glove,elbow length 8', 83.72, 163.8, '0.00', 1004.64, 54.6, 0, 12, 8.19),
(10989, 203, 'PVC Red smooth shoulder glove ', 53.67, 8750, '0.00', 53666.67, 35, 0, 1000, 5.25),
(10988, 203, 'Dromex PVC Red Glove Knit Wrist', 13.8, 2250, '0.00', 13800, 9, 0, 1000, 1.3499999999999999),
(10987, 203, 'Dromex Crayfish Glove', 13.8, 6750, '0.00', 41400, 9, 0, 3000, 1.35),
(11010, 204, 'Lady\'s Canteen Coat short sleeve size S-4XL (Available in royal blue or Green)', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(11008, 118, 'Cotton Glove ', 5.53, 207.5, '0.00', 1106.67, 4.15, 0, 200, 0),
(11009, 118, 'Spectacle EURO Clear adjustable Frame', 16.19, 36.42, '0.00', 194.24, 12.14, 0, 12, 0),
(13559, 206, 'Embroidery Zee Lodge', 27.6, 18, '0.00', 110.4, 18, 0, 4, 2.7),
(13558, 206, 'Dromex  Navy Conti suit with Reflective Tape size 44', 240.7, 78.49, '0.00', 481.41, 156.98, 0, 2, 23.547),
(13557, 206, 'Lady\'s Canteen Coat short sleeve size 2XL Green', 107.33, 35, '0.00', 214.67, 70, 0, 2, 10.5),
(13226, 209, 'DROMEX Viper Category III chemical glove, Size 10', 46, 375, '0.00', 2300, 30, 0, 50, 4.5),
(13227, 209, 'Dromex BLEACHED Cotton crochet glove', 4.6, 15, '0.00', 92, 3, 0, 20, 0.45),
(13205, 207, 'Navy Dust Coat long sleeve S- 4XL', 90.47, 2950, '0.00', 18093.33, 59, 0, 200, 8.85),
(13204, 207, 'Blue MUSHROOM Re-Usable Earplug with green cord', 2.91, 95, '0.00', 582.67, 1.9, 0, 200, 0.285),
(13200, 207, 'Safety Cap Rhino Heat Resistant Silver 4P Pinlock', 99.67, 16.25, '0.00', 99.67, 65, 0, 1, 9.75),
(13201, 207, 'Safety Cap Rhino Heat Resistant Orange 4P Ratchet', 107.33, 17.5, '0.00', 107.33, 70, 0, 1, 10.5),
(13202, 207, 'Ear Muff Red', 24.53, 4, '0.00', 24.53, 16, 0, 1, 2.4),
(13203, 207, 'Uvex,Whisper,Flange Type,Corded', 9.2, 150, '0.00', 920, 6, 0, 100, 0.9),
(13199, 207, 'Euro SPEC A/S CLEAR DV-026C', 12.27, 2, '0.00', 12.27, 8, 0, 1, 1.2),
(13198, 207, 'SPORTI SPEC CLEAR  DV-12C', 12.13, 1.9775, '0.00', 12.13, 7.91, 0, 1, 1.1865);
INSERT INTO `tb_quote_items` (`item_id`, `item_quote_id`, `item_product`, `item_price`, `item_profit`, `item_discount`, `item_subtotal`, `item_cost`, `item_supplier_id`, `item_qty`, `item_vat`) VALUES
(13196, 207, 'Dromex Spectacle EURO Clear Anti Scratch  adjustable Frame', 12.27, 2, '0.00', 12.27, 8, 0, 1, 1.2),
(13197, 207, 'SPOGGLE, CLEAR, ANTI MIST', 76.67, 12.5, '0.00', 76.67, 50, 0, 1, 7.5),
(13193, 207, 'Dromex PVC Rubberised Rain Suit Yellow S- 4XL', 115, 468.75, '0.00', 2875, 75, 0, 25, 11.25),
(13194, 207, 'DROMEX A2P3 EN FILTER NRCS/8072/0424 Twin pack', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(13195, 207, 'Dromex Spectacle EURO Green Anti Scratch adjustable Frame', 12.27, 2, '0.00', 12.27, 8, 0, 1, 1.2),
(13192, 207, 'Rags/ Kg (MOQ 25kg)', 24.53, 100, '0.00', 613.33, 16, 0, 25, 2.4),
(13191, 207, 'White PVC Apron Heavy Duty 450gm', 30.67, 5, '0.00', 30.67, 20, 0, 1, 3),
(13190, 207, 'Dromex Grip green latex coat, crinkle palm glove', 9.2, 1.5, '0.00', 9.2, 6, 0, 1, 0.9),
(13189, 207, 'NITRIFLEX Black Sanitized FULL nitrile coated', 29.13, 4.75, '0.00', 29.13, 19, 0, 1, 2.85),
(13188, 207, 'Black PU palm coated on black knitted shell Flex', 10.52, 1.715, '0.00', 10.52, 6.86, 0, 1, 1.029),
(13187, 207, 'MIIZU300 BLUE, palm coated, size 10', 18.4, 3, '0.00', 18.4, 12, 0, 1, 1.8),
(13186, 207, 'MIDIMASK TPR Double Mask - GREY (NRCS: AZ2011/46)', 92, 15, '0.00', 92, 60, 0, 1, 9),
(13185, 207, 'Metaguard - Clear', 55.2, 9, '0.00', 55.2, 36, 0, 1, 5.4),
(13184, 207, '145g Long Sleeve T-Shirt', 153.32, 24.9975, '0.00', 153.32, 99.99, 0, 1, 14.9985),
(13183, 207, 'LEMAITRE  - Turtle (Zeus Metatarsal) - 8132', 920, 150, '0.00', 920, 600, 0, 1, 90),
(13182, 207, 'LEMAITRE MAXECO 8061 Metaguard', 613.33, 100, '0.00', 613.33, 400, 0, 1, 60),
(13181, 207, 'LEMAITRE 8031 MAXECO BLACK OR BROWN', 460, 75, '0.00', 460, 300, 0, 1, 45),
(13177, 207, 'Chrome Leather Welding Apron 1 piece  60x 120', 119.6, 19.5, '0.00', 119.6, 78, 0, 1, 11.7),
(13178, 207, 'Chrome Leather Welding Apron 1 piece 90 x 60', 92, 15, '0.00', 92, 60, 0, 1, 9),
(13179, 207, 'Chrome Leather Welding Jacket S-4XL', 345, 56.25, '0.00', 345, 225, 0, 1, 33.75),
(13180, 207, 'Chrome Leather Knee Spats ', 108.41, 17.675, '0.00', 108.41, 70.7, 0, 1, 10.605),
(13176, 207, 'Gold Hands Blue Nitrile Glove Powder-Free 100 pcs/box ', 61.33, 10, '0.00', 61.33, 40, 0, 1, 6),
(13173, 207, 'DROMEX Tan Pig grain, keystone, size 12', 73.81, 12.035, '0.00', 73.81, 48.14, 0, 1, 7.221),
(13174, 207, ' KN95 MOULDED , 5150 MEDICAL MASK', 3.07, 10, '0.00', 61.33, 2, 0, 20, 0.3),
(13175, 207, 'Golden Hands Latex Examination Glove Powdered 100 pcs/box ', 69, 11.25, '0.00', 69, 45, 0, 1, 6.75),
(13172, 207, 'DROMEX Tan Pig grain, keystone, size 11', 50.6, 8.25, '0.00', 50.6, 33, 0, 1, 4.95),
(13170, 207, 'DROMEX Tan Pig grain, keystone, size 9', 50.6, 8.25, '0.00', 50.6, 33, 0, 1, 4.95),
(13171, 207, 'DROMEX Tan Pig grain, keystone, size 10', 50.6, 8.25, '0.00', 50.6, 33, 0, 1, 4.95),
(13168, 207, 'Chin Strap 4 point Delux - without Chin Guard - Velcro attachment', 38.33, 6.25, '0.00', 38.33, 25, 0, 1, 3.75),
(13169, 207, 'DROMEX Tan Pig grain, keystone, size 8', 53.67, 8.75, '0.00', 53.67, 35, 0, 1, 5.25),
(13167, 207, 'Chin Strap 4 point Delux - with Chin Guard - Velcro attachment', 41.4, 6.75, '0.00', 41.4, 27, 0, 1, 4.05),
(13166, 207, 'Chin strap elastic 2 point', 10.73, 1.75, '0.00', 10.73, 7, 0, 1, 1.05),
(13165, 207, 'Wayne Gripper Gumboot STC Size 3-13', 199.33, 32.5, '0.00', 199.33, 130, 0, 1, 19.5),
(13164, 207, 'Goatskin VIP, Keystone, size 10', 30.67, 5, '0.00', 30.67, 20, 0, 1, 3),
(13163, 207, 'Mouth Piece for Fire-X', 122.67, 20, '0.00', 122.67, 80, 0, 1, 12),
(13162, 207, 'Goggle  Fire-X, Fire Fighting', 205.47, 33.5, '0.00', 205.47, 134, 0, 1, 20.1),
(13161, 207, 'FFP2 QSA, VALVE (SABS REF: AZ2006/29)', 5.37, 10.5, '0.00', 64.4, 3.5, 0, 12, 0.525),
(13160, 207, 'FFP2 QSA (SABS REF: AZ2006/20)', 3.83, 12.5, '0.00', 76.67, 2.5, 0, 20, 0.375),
(13159, 207, 'Dromex Kidney Belt size S -2XL', 75.13, 12.25, '0.00', 75.13, 49, 0, 1, 7.35),
(13158, 207, 'Dromex J-Muff, 25 SNR, Blue', 41.4, 6.75, '0.00', 41.4, 27, 0, 1, 4.05),
(13157, 207, 'DROMEX ANTI-STATIC BLACK SOCKS, SIZE 8-11', 44.47, 7.25, '0.00', 44.47, 29, 0, 1, 4.35),
(13156, 207, 'PROMAX white Disposable Overalls, Small to 3XL', 61.33, 10, '0.00', 61.33, 40, 0, 1, 6),
(13155, 207, 'Disposable Overalls, 50gsm non woven, Medium to 3X Large', 29.13, 4.75, '0.00', 29.13, 19, 0, 1, 2.85),
(13154, 207, 'Dromex Promax 1000 Medical Disposable', 138, 22.5, '0.00', 138, 90, 0, 1, 13.5),
(13151, 207, 'D59 NAVY FLAME / ACID JACKET REFLECTIVE ', 276, 45, '0.00', 276, 180, 0, 1, 27),
(13153, 207, 'DROMEX PROMAX-C4000 Coverall Type 3,4,5,6', 337.33, 55, '0.00', 337.33, 220, 0, 1, 33),
(13152, 207, 'D59 NAVY FLAME / ACID TROUSER REFLECTIVE ', 276, 45, '0.00', 276, 180, 0, 1, 27),
(13150, 207, 'DROMEX CONTI TROUSER SABS FLAME/ACID + TAPE FERN GREEN', 306.67, 50, '0.00', 306.67, 200, 0, 1, 30),
(13149, 207, 'DROMEX CONTI JACKET SABS FLAME/ACID + TAPE FERN GREEN ', 306.67, 50, '0.00', 306.67, 200, 0, 1, 30),
(13148, 207, 'Dromex COMAREX, yellow latex fully dipped glove, knit cuff', 19.93, 3.25, '0.00', 19.93, 13, 0, 1, 1.95),
(13147, 207, 'Ansell Hyflex Oil Repel Neoprene Nitrile Palm Coat Purple Size 10', 121.13, 19.75, '0.00', 121.13, 79, 0, 1, 11.85),
(13146, 207, 'DROMEX ALUMINISED LEATHER GLOVES (500 °C)', 766.67, 125, '0.00', 766.67, 500, 0, 1, 75),
(13144, 207, 'Aluminium cap bracket for Visor/Hard Hat', 53.67, 8.75, '0.00', 53.67, 35, 0, 1, 5.25),
(13145, 207, 'DROMEX ALUMINISED KEVLAR GLOVES (500 °C)', 996.67, 162.5, '0.00', 996.67, 650, 0, 1, 97.5),
(13143, 207, 'Face Shield replacement visor clear', 30.67, 5, '0.00', 30.67, 20, 0, 1, 3),
(13141, 207, '501,Pre-Filter Retainer - MUST PURCHASE PER PACKET OF 2', 23, 7.5, '0.00', 46, 15, 0, 2, 2.25),
(13142, 207, 'Green lined glove elbow length 8', 53.67, 8.75, '0.00', 53.67, 35, 0, 1, 5.25),
(13140, 207, '3M 2138 (2097) OV/AG FILTER P3', 107.33, 35, '0.00', 214.67, 70, 0, 2, 10.5),
(12939, 208, 'Boot - Thuli -  Chelsea Ladies - RE940 Size 5', 1351.33, 220.325, '0.00', 1351.33, 881.3, 0, 1, 132.195),
(12938, 208, 'Boot - Thuli -  Chelsea Ladies - RE940 Size 3', 1351.33, 220.325, '0.00', 1351.33, 881.3, 0, 1, 132.195),
(13224, 209, 'DROMEX EN302 TWIN MASK NRCS/8072/0413( with respirator bag), Size MEDIUM', 176.33, 575, '0.00', 3526.67, 115, 0, 20, 17.25),
(13225, 209, 'DROMEX ABEK1P3-EN FILTER NRCS/8072/0425 Twin', 352.67, 575, '0.00', 3526.67, 230, 0, 10, 34.5),
(13222, 209, 'DROMEX MAXI MASK - BLACK (NRCS: AZ8072/0187) ( Including bag)', 1548.67, 2525, '0.00', 15486.67, 1010, 0, 10, 151.5),
(13223, 209, 'Dromex ABEK1 - TWIN UNIFIT Filter (NRCS: AZ2011/56)', 230, 750, '0.00', 4600, 150, 0, 20, 22.5),
(13232, 210, 'Rags/ kg', 18, 293.5, '0.00', 1800.13, 11.74, 0, 100, 1.761),
(13233, 210, 'Household Broom with Plastic Handle', 55.2, 90, '0.00', 552, 36, 0, 10, 5.4),
(13248, 211, 'Acid and Flame resistant Lab coats WHITE. Size 48', 765.13, 499, '0.00', 3060.53, 499, 0, 4, 74.85),
(13247, 211, 'Acid and Flame resistant Lab coats WHITE. Size 46', 765.13, 124.75, '0.00', 765.13, 499, 0, 1, 74.85),
(13246, 211, 'Acid and Flame resistant Lab coats WHITE. Size 40', 765.13, 873.25, '0.00', 5355.93, 499, 0, 7, 74.85),
(13245, 211, 'Acid and Flame resistant Lab coats WHITE. Size 38', 765.13, 374.25, '0.00', 2295.4, 499, 0, 3, 74.85),
(13244, 211, 'Acid and Flame resistant Lab coats WHITE. Size 36', 765.13, 374.25, '0.00', 2295.4, 499, 0, 3, 74.85),
(13567, 212, 'Cotton wool 500g', 107.33, 17.5, '0.00', 107.33, 70, 0, 1, 10.5),
(13569, 212, '3M ABEK1 Cartridge 6059 ', 228.47, 298, '0.00', 1827.73, 149, 0, 8, 22.35),
(13568, 212, 'Varta 9V Long Life Alkaline', 61.33, 40, '0.00', 245.33, 40, 0, 4, 6),
(13566, 212, 'P2 Cartridges (Dust Cartridge)', 50.6, 16.5, '0.00', 101.2, 33, 0, 2, 4.95),
(13565, 212, 'Citronol Hand Cleaner with grit 30 Kg', 736, 120, '0.00', 736, 480, 0, 1, 72),
(13564, 212, 'Red heat resistant apron palm welding glove,', 75.13, 294, '0.00', 1803.2, 49, 0, 24, 7.35),
(13563, 212, 'Dromex Cotton Glove ', 4.45, 145, '0.00', 889.33, 2.9, 0, 200, 0.435),
(13562, 212, 'Dromex Chrome leather double palm elbow length 8', 43.7, 171, '0.00', 1048.8, 28.5, 0, 24, 4.275),
(13561, 212, 'Dromex Chrome leather double palm  wrist length 2.5', 35.27, 138, '0.00', 846.4, 23, 0, 24, 3.45),
(13560, 212, 'Wire Nails 75mm / kg', 46, 22.5, '0.00', 138, 30, 0, 3, 4.5),
(13526, 214, 'Dromex NITROLITE grey nitrile PALM coated on white shell,', 10.61, 1.73, '0.00', 10.61, 6.92, 0, 1, 1.038),
(13525, 214, 'FFP2 Dust Mask SABS Approved', 3.68, 12, '0.00', 73.6, 2.4, 0, 20, 0.36),
(13511, 213, 'PVC Red smooth shoulder glove (No Elastic)', 107.33, 17.5, '0.00', 107.33, 70, 0, 1, 10.5),
(13510, 213, 'Wayne Duralight Black Gumboot NSTC ', 138, 22.5, '0.00', 138, 90, 0, 1, 13.5),
(13501, 213, 'Dromex D59 Flame and Acid Jacket All Sizes', 309.73, 50.5, '0.00', 309.73, 202, 0, 1, 30.3),
(13502, 213, 'Dromex D59 Flame and Acid Pants All Sizes', 309.73, 50.5, '0.00', 309.73, 202, 0, 1, 30.3),
(13503, 213, 'Dromex Navy Conti suit with Reflective Tape', 230, 37.5, '0.00', 230, 150, 0, 1, 22.5),
(13504, 213, 'Denim Coni suit size 28-44', 260.67, 42.5, '0.00', 260.67, 170, 0, 1, 25.5),
(13505, 213, 'Dromex Chrome leather double palm  wrist length 2.5 inch, wrist', 33.73, 5.5, '0.00', 33.73, 22, 0, 1, 3.3),
(13506, 213, 'Black PU palm coated on black knitted shell (Ninja Glove All black)', 9.2, 1.5, '0.00', 9.2, 6, 0, 1, 0.9),
(13509, 213, 'DROMEX BOXER BLACK SAFETY BOOT', 306.67, 50, '0.00', 306.67, 200, 0, 1, 30),
(13508, 213, 'Chrome Leather Welding Apron 1 piece  60x 120', 125.73, 20.5, '0.00', 125.73, 82, 0, 1, 12.3),
(13507, 213, 'Blood and Fat Apron', 75.13, 12.25, '0.00', 75.13, 49, 0, 1, 7.35),
(13524, 214, 'Dromex D59 Flame and Acid Pants All Sizes', 306.67, 50, '0.00', 306.67, 200, 0, 1, 30),
(13523, 214, 'Dromex D59 Flame and Acid Jacket All Sizes', 306.67, 50, '0.00', 306.67, 200, 0, 1, 30),
(13551, 215, 'Metro Reflective Jacket Detachable Sleeve S-2XL', 207, 2733.75, '0.00', 16767, 135, 0, 81, 20.25),
(13548, 215, 'Wayne Gripper Gumboot STC Size ', 214.67, 420, '0.00', 2576, 140, 0, 12, 21),
(13550, 215, 'Silver Ref Tape Arms and Waist', 38.33, 143.75, '0.00', 881.67, 25, 0, 23, 3.75),
(13549, 215, 'Navy Blue Freezer Jacket M- 2XL', 322, 1207.5, '0.00', 7406, 210, 0, 23, 31.5),
(13547, 215, 'Wayne MINER ANKLE BLK TOFF SABS STC # - 1860', 260.67, 85, '0.00', 521.33, 170, 0, 2, 25.5),
(13546, 215, 'Boot - JCB Hiker HRO Brown ', 1196, 2535, '0.00', 15548, 780, 0, 13, 117),
(13553, 216, 'Face Shield clear complete', 42.93, 70, '0.00', 429.33, 28, 0, 10, 4.2),
(14080, 219, 'Navy Blue Freezer Jacket M- 2XL', 294.4, 48, '0.00', 294.4, 192, 0, 1, 28.8),
(14014, 217, 'Taeki5 Cut & Heat apron 60x120cm - Fully Adjustable', 613.33, 4000, '0.00', 24533.33, 400, 0, 40, 60),
(14015, 217, 'DROMEX FFP3 V, FLAT FOLD mask with adjustable headband', 23, 900, '0.00', 5520, 15, 0, 240, 2.25),
(14016, 217, 'Logo Embroidery Front Left Chest', 23, 56.25, '0.00', 345, 15, 0, 15, 2.25),
(14012, 217, 'P2 - SINGLE UNIFIT Filter (NRCS: AZ2011/67) 2 70  48.84', 55.2, 360, '0.00', 2208, 36, 0, 40, 5.4),
(14013, 217, 'Taeki5 Cut & Heat apron 60x120cm - Fully Adjustable', 613.33, 4000, '0.00', 24533.33, 400, 0, 40, 60),
(14011, 217, 'DROMEX P2-EN FILTER TWIN NRCS/8072/0422 80 ', 69, 450, '0.00', 2760, 45, 0, 40, 6.75),
(14010, 217, 'Dromex Double Respirator', 75.13, 490, '0.00', 3005.33, 49, 0, 40, 7.35),
(14009, 217, 'Dromex Single Respirator', 62.87, 410, '0.00', 2514.67, 41, 0, 40, 6.15),
(14008, 217, 'Green lined glove elbow length 8', 53.67, 87.5, '0.00', 536.67, 35, 0, 10, 5.25),
(14007, 217, 'DROMEX Brown rough PVC gloves, 35cm elbow', 32.2, 52.5, '0.00', 322, 21, 0, 10, 3.15),
(14006, 217, 'Dromex Kidney Belt size S -2XL', 75.13, 1225, '0.00', 7513.33, 49, 0, 100, 7.35),
(14005, 217, 'Dromex Ear Plug Tri Flange, Reusable', 2.76, 900, '0.00', 5520, 1.8, 0, 2000, 0.27),
(14004, 217, 'DROMEX CUT5 SEAMLESS KNITWRIST LINER Size 10', 41.4, 1620, '0.00', 9936, 27, 0, 240, 4.05),
(14002, 217, 'Wayne Duralight Black Gumboot NSTC Size 3-13', 138, 10440, '0.00', 64032, 90, 0, 464, 13.5),
(14003, 217, 'Ear MuffJ , 25 SNR, Blue', 30.67, 1220, '0.00', 7482.67, 20, 0, 244, 3),
(14001, 217, 'Dromex PVC Rubberised Rain Suit Navy S- 4XL', 119.6, 4738.5, '0.00', 29062.8, 78, 0, 243, 11.7),
(14000, 217, 'Navy Blue Freezer Trouser M-2XL', 260.67, 2252.5, '0.00', 13815.33, 170, 0, 53, 25.5),
(13999, 217, 'Navy Blue Freezer Jacket M- 2XL', 300, 11934.65, '0.00', 73199.19, 195.65, 0, 244, 29.3475),
(13998, 217, 'DROMEX BOXER BLACK SAFETY BOOT', 299, 11797.5, '0.00', 72358, 195, 0, 242, 29.25),
(13997, 217, 'DROMEX LADIES DENIM Jean PANTS', 291.33, 4180, '0.00', 25637.33, 190, 0, 88, 28.5),
(13994, 217, 'Dromex D59 Flame and Acid Jacket All Sizes', 291.33, 19095, '0.00', 117116, 190, 0, 402, 28.5),
(13995, 217, 'Dromex D59 Flame and Acid Pants All Sizes', 291.33, 18810, '0.00', 115368, 190, 0, 396, 28.5),
(13996, 217, 'DROMEX 100% cotton  PIQUE KNIT GOLFER, Size XS-5XL', 92, 1230, '0.00', 7544, 60, 0, 82, 9),
(13993, 217, 'DROMEX COLOURS T Shirs 165gsm 100% Cotton', 61.33, 4000, '0.00', 24533.33, 40, 0, 400, 6),
(14072, 218, 'DROMEX  COMPLIANT 65/35 CONTI PANTS White, All Sizes', 161, 26.25, '0.00', 161, 105, 0, 1, 15.75),
(14071, 218, 'DROMEX  COMPLIANT 65/35 CONTI JACKET White, All Sizes', 161, 26.25, '0.00', 161, 105, 0, 1, 15.75),
(14070, 218, 'Conti suits 80/20 White size 28-44', 176.33, 28.75, '0.00', 176.33, 115, 0, 1, 17.25),
(14069, 218, 'Conti suits Polycotton White size  size 54', 168.67, 27.5, '0.00', 168.67, 110, 0, 1, 16.5),
(14068, 218, 'Conti suits Polycotton White size  size 52', 161, 26.25, '0.00', 161, 105, 0, 1, 15.75),
(14067, 218, 'Conti suits Polycotton White size  size 50', 153.33, 25, '0.00', 153.33, 100, 0, 1, 15),
(14066, 218, 'Conti suits Polycotton White size 48', 145.67, 23.75, '0.00', 145.67, 95, 0, 1, 14.25),
(14065, 218, 'Conti suits Polycotton White size  size 46', 138, 22.5, '0.00', 138, 90, 0, 1, 13.5),
(14064, 218, 'Conti suits Polycotton White size 28-44', 122.67, 20, '0.00', 122.67, 80, 0, 1, 12),
(14079, 219, 'DROMEX BOXER BLACK SAFETY BOOT', 300.53, 49, '0.00', 300.53, 196, 0, 1, 29.4),
(14078, 219, 'Dromex D59 Flame and Acid Pants All Sizes', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(14077, 219, 'Dromex D59 Flame and Acid Jacket All Sizes', 299, 48.75, '0.00', 299, 195, 0, 1, 29.25),
(14177, 220, 'Dromex Chrome leather candy stripe glove', 24.53, 80, '0.00', 490.67, 16, 0, 20, 2.4),
(14174, 220, 'Dromex Lime Reflective Vest with Zip & ID 2XL', 35.27, 17.25, '0.00', 105.8, 23, 0, 3, 3.45),
(14175, 220, 'Dromex Crayfish Glove', 12.27, 100, '0.00', 613.33, 8, 0, 50, 1.2),
(14176, 220, 'Safety Officer Reflective Jacket Detachable Sleeve XL', 195.04, 63.6, '0.00', 390.08, 127.2, 0, 2, 19.08),
(14173, 220, 'Dromex Lime Reflective Vest with Zip & ID XL', 35.27, 23, '0.00', 141.07, 23, 0, 4, 3.45),
(14166, 220, 'Dromex Spectacle EURO Clear adjustable Frame (12 in box)', 13.91, 136.05, '0.00', 834.44, 9.07, 0, 60, 1.3605),
(14167, 220, 'FFP2 Dust Mask SABS Approved (20 in a box)', 3.68, 720, '0.00', 4416, 2.4, 0, 1200, 0.36),
(14168, 220, 'Safety Officer Reflective Jacket Detachable Sleeve M', 195.04, 159, '0.00', 975.2, 127.2, 0, 5, 19.08),
(14169, 220, 'Safety Officer Reflective Jacket Detachable Sleeve L', 195.04, 222.6, '0.00', 1365.28, 127.2, 0, 7, 19.08),
(14170, 220, 'Safety Officer Reflective Jacket Detachable Sleeve 2XL', 195.04, 31.8, '0.00', 195.04, 127.2, 0, 1, 19.08),
(14171, 220, 'Dromex Lime Reflective Vest with Zip & ID M', 35.27, 23, '0.00', 141.07, 23, 0, 4, 3.45),
(14172, 220, 'Dromex Lime Reflective Vest with Zip & ID L', 35.27, 23, '0.00', 141.07, 23, 0, 4, 3.45),
(14165, 220, 'Dromex Ear Plug Tri Flange 3D, Reusable ', 3.37, 55, '0.00', 337.33, 2.2, 0, 100, 0.33),
(14348, 221, 'Dromex Chrome leather double palm  wrist length 2.5', 33.73, 66, '0.00', 404.8, 22, 0, 12, 3.3),
(14347, 221, 'Varta 9V Long Life Alkaline Square', 61.33, 30, '0.00', 184, 40, 0, 3, 6),
(14346, 221, 'Varta Longlife AAA-C4 Alkaline (Gold)', 64.4, 31.5, '0.00', 193.2, 42, 0, 3, 6.3),
(14345, 221, 'Varta AA LongLife Alkaline 4 Pack (Gold) ', 65.93, 32.25, '0.00', 197.8, 43, 0, 3, 6.45),
(14344, 221, 'Dromex Yellow household Glove with Flock Liner', 9.15, 17.91, '0.00', 109.85, 5.97, 0, 12, 0.8955),
(14343, 221, 'Red heat resistant apron palm welding glove,', 73.45, 179.625, '0.00', 1101.7, 47.9, 0, 15, 7.185),
(14342, 221, 'Toilet Paper Virgin 48\'s (2Ply)', 237.67, 77.5, '0.00', 475.33, 155, 0, 2, 23.25),
(14341, 221, 'Gas Cartridges 190g', 39.87, 39, '0.00', 239.2, 26, 0, 6, 3.9),
(14340, 221, 'Rags - Super Absorbent (P/KG)', 21.01, 85.625, '0.00', 525.17, 13.7, 0, 25, 2.055),
(14337, 221, 'DROMEX AGRIMac JACKET, 2X LARGE (Storm)', 414, 135, '0.00', 828, 270, 0, 2, 40.5),
(14338, 221, 'DROMEX AGRIMac BIB PANTS, 2X LARGE (Storm)', 335.19, 109.3, '0.00', 670.37, 218.6, 0, 2, 32.79),
(14339, 221, 'Blue lined  welding glove,elbow length 8', 73.45, 143.7, '0.00', 881.36, 47.9, 0, 12, 7.185),
(14336, 221, 'Dromex Spectacle EURO Clear adjustable Frame', 12.07, 23.61, '0.00', 144.81, 7.87, 0, 12, 1.1805),
(14335, 221, 'Domex Rough Palm, Rolled Cuff, Shoulder 55cm length (Chemical)', 48.3, 94.5, '0.00', 579.6, 31.5, 0, 12, 4.725),
(14334, 221, 'FFP2 Dust Mask SABS Approved', 3.68, 60, '0.00', 368, 2.4, 0, 100, 0.36),
(14353, 222, 'Sports Bag with Grey Trim Bag Size: 50 x 18 x 24.5cm', 337.33, 55, '0.00', 337.33, 220, 0, 1, 33),
(14352, 222, 'Dual Material Duffel Bag 600D Non-Woven Bag Size: 44 x 25 x 20cm', 283.67, 46.25, '0.00', 283.67, 185, 0, 1, 27.75),
(14354, 222, 'WTY Print ', 69, 11.25, '0.00', 69, 45, 0, 1, 6.75),
(14367, 223, 'DROMEX BOXER BLACK SAFETY BOOT', 291.33, 47.5, '0.00', 291.33, 190, 0, 1, 28.5),
(14366, 223, 'DROMEX All Colours Polycotton All sizes with Ref Tape', 240.7, 39.245, '0.00', 240.7, 156.98, 0, 1, 23.547),
(14365, 223, 'DROMEX All Colours Polycotton All sizes', 215.74, 35.175, '0.00', 215.74, 140.7, 0, 1, 21.105),
(14364, 223, 'Javlin FFTJ Conti Suit Navy Polycotton', 381.8, 62.25, '0.00', 381.8, 249, 0, 1, 37.35),
(14368, 223, 'ROKO CHUKKA Boots ', 268.33, 43.75, '0.00', 268.33, 175, 0, 1, 26.25),
(14372, 225, 'BROOM MTS HOUSEHOLD BRITE COLOURED', 106.67, 100, '0.00', 533.33, 80, 0, 5, 0),
(14371, 225, 'Broom platform 450mm SOFT - BLACK F3351', 146.67, 275, '0.00', 1466.67, 110, 0, 10, 0),
(14828, 226, 'Embroidery Names and Digits', 21.47, 4.025, '0.00', 21.47, 16.1, 0, 1, 0),
(14732, 227, 'Hybrid Fleece Jackets', 328, 61.5, '0.00', 328, 246, 0, 1, 0),
(14827, 226, 'Logo Embroidery Front Left Chest/ Left Leg', 23, 4.3125, '0.00', 23, 17.25, 0, 1, 0),
(14826, 226, 'DROMEX Rough Palm, Rolled Cuff, Elbow 40cm length', 43.67, 8.1875, '0.00', 43.67, 32.75, 0, 1, 0),
(14825, 226, 'Dromex D59 Flame and Acid Pants All Sizes', 306.67, 57.5, '0.00', 306.67, 230, 0, 1, 0),
(14824, 226, 'Dromex D59 Flame and Acid Jacket All Sizes', 306.67, 57.5, '0.00', 306.67, 230, 0, 1, 0),
(14822, 226, 'Wayne Duralight Black Gumboot NSTC Size 3-13', 153.33, 28.75, '0.00', 153.33, 115, 0, 1, 0),
(14823, 226, 'Bova Chelsea Boot Size 3-13 ', 1330, 249.375, '0.00', 1330, 997.5, 0, 1, 0),
(14820, 226, 'Snowsoft Jumbo Wipes 200 1Ply 900m ', 306.67, 57.5, '0.00', 306.67, 230, 0, 1, 0),
(14821, 226, 'FFP2 Dust Mask SABS Approved', 3.73, 0.7, '0.00', 3.73, 2.8, 0, 1, 0),
(14818, 226, 'DROMEX CUT5 RESISTANT SEAMLESS KNITWRIST LINER', 48.93, 9.175, '0.00', 48.93, 36.7, 0, 1, 0),
(14819, 226, 'Snowsoft  1Ply VIRGIN 48s ', 191.68, 35.94, '0.00', 191.68, 143.76, 0, 1, 0),
(14817, 226, 'DROMEX MIIZU 300HI, HI VIZ, palm coated,', 21.75, 4.0775, '0.00', 21.75, 16.31, 0, 1, 0),
(14816, 226, 'DROMEX Brown ROUGH PALM PVC gloves, 27cm open cuff', 34.15, 6.4025, '0.00', 34.15, 25.61, 0, 1, 0),
(14815, 226, 'DROMEX Standard PVC, Open Cuff Wrist Length', 13.8, 2.5875, '0.00', 13.8, 10.35, 0, 1, 0),
(14812, 226, 'Face Shield clear complete', 45.33, 8.5, '0.00', 45.33, 34, 0, 1, 0),
(14813, 226, 'RED HEAT RESIST GLOVE ELBOW - KEVLAR STITCH', 105.8, 19.8375, '0.00', 105.8, 79.35, 0, 1, 0),
(14814, 226, 'Dromex COMAREX, yellow latex fully dipped glove, knit cuff', 23.69, 4.4425, '0.00', 23.69, 17.77, 0, 1, 0),
(14811, 226, 'Dromex SPOGGLE, CLEAR, ANTI MIST', 85.2, 15.975, '0.00', 85.2, 63.9, 0, 1, 0),
(14810, 226, 'PROMAX-S-3XL PROMAX white Disposable Coveralls,', 76, 28.5, '0.00', 152, 57, 0, 2, 0),
(14809, 226, '3M 6059,Cartridge - ABEK1 ', 230, 86.25, '0.00', 460, 172.5, 0, 2, 0),
(14808, 226, '3M 6800,Full Face Mask (Facepiece)', 4133.33, 775, '0.00', 4133.33, 3100, 0, 1, 0),
(14805, 226, 'Safety Hard Cap All colours', 19.87, 3.725, '0.00', 19.87, 14.9, 0, 1, 0),
(14807, 226, '3M 6300,Half Mask (Facepiece) ', 352.67, 66.125, '0.00', 352.67, 264.5, 0, 1, 0),
(14806, 226, 'Dromex Ear Plug Tri Flange, Reusable ', 2.99, 112, '0.00', 597.33, 2.24, 0, 200, 0),
(14848, 228, 'DROMEX ARC HRC2 - 15Cal PANTS', 1080, 202.5, '0.00', 1080, 810, 0, 1, 0),
(14847, 228, 'DROMEX ARC HRC2 - 15Cal JACKET', 1112, 208.5, '0.00', 1112, 834, 0, 1, 0),
(15089, 229, 'Names Embroided', 18.67, 38.5, '0.00', 205.33, 14, 0, 11, 0),
(14866, 230, 'Fingersaver 350 mm', 1439.52, 1349.55, '0.00', 7197.6, 1079.64, 0, 5, 0),
(15088, 229, 'Your Safety , our priority Embroided', 24, 49.5, '0.00', 264, 18, 0, 11, 0),
(15087, 229, 'Trencon Logo at the Back Embroided', 46.67, 96.25, '0.00', 513.33, 35, 0, 11, 0),
(15086, 229, 'Navy / yellow Vented Reflective Mining Shirt (3xL; 3xM;3xS; 2xM)', 285.33, 588.5, '0.00', 3138.67, 214, 0, 11, 0),
(14869, 231, 'TaeKi5 NAVY ROUGH coated NITRILE, safety cuff', 160, 1500, '0.00', 8000, 120, 0, 50, 0),
(14981, 232, 'Varta Industrial AA (Pack of 10)', 93.33, 17.5, '0.00', 93.33, 70, 0, 1, 0),
(14980, 232, 'CABLETIE  BLACK 300X4.8MM PK100 T50I (MOQ 10 Packs)', 100, 187.5, '0.00', 1000, 75, 0, 10, 0),
(14979, 232, 'Wayne Duralight Black Gumboot NSTC Size 8', 152.67, 57.25, '0.00', 305.33, 114.5, 0, 2, 0),
(14978, 232, 'Citronol Hand Cleaner with grit 30 Kg', 736, 138, '0.00', 736, 552, 0, 1, 0),
(14977, 232, 'CABLETIE Helleman Tyton BLACK 310X4.8MM PK100 T50I ', 133.33, 100, '0.00', 533.33, 100, 0, 4, 0),
(14976, 232, 'Dromex Kidney Belt size M', 80, 30, '0.00', 160, 60, 0, 2, 0),
(15038, 233, 'Plastic (P.E.) Sleeve Protectors Blue or White  100\'s', 28.4, 5.325, '0.00', 28.4, 21.3, 0, 1, 0),
(15039, 233, 'KN95 Mask', 1.87, 7, '0.00', 37.33, 1.4, 0, 20, 0),
(15040, 233, 'DROMEX Category III chemical glove - AS PER SAMPLE', 44.67, 8.375, '0.00', 44.67, 33.5, 0, 1, 0),
(15001, 234, 'Dromex Ear Plug Tri Flange, Reusable (Box of 200)', 2.65, 99.5, '0.00', 530.67, 1.99, 0, 200, 0),
(15034, 233, 'White Blood and Fat Apron', 68, 12.75, '0.00', 68, 51, 0, 1, 0),
(15035, 233, 'Plastic Apron 100\'S 10 Microns, White, Clear, Red, Blue', 41.33, 7.75, '0.00', 41.33, 31, 0, 1, 0),
(15036, 233, 'Mop Caps All Colours 100\'s', 24, 4.5, '0.00', 24, 18, 0, 1, 0),
(15037, 233, 'White Beard Covers white 100\'s', 40, 7.5, '0.00', 40, 30, 0, 1, 0),
(15000, 234, 'Dromex Goatskin VIP, Keystone  Size 10', 30.67, 345, '0.00', 1840, 23, 0, 60, 0),
(15049, 236, 'Washed Cotton Outdoor Hat- Grey', 200, 112500, '0.00', 600000, 150, 0, 3000, 0),
(15031, 235, 'GLASS BEAKER WITH SPOUT LOW FORM 500ml', 75, 14.0625, '0.00', 75, 56.25, 0, 1, 0),
(15032, 235, 'SPATULA SPOON STAINLESS STEEL 200MM ', 61.47, 11.525, '0.00', 61.47, 46.1, 0, 1, 0),
(15033, 235, 'OIL TEST STRIPS - 100 pack', 2306.67, 432.5, '0.00', 2306.67, 1730, 0, 1, 0),
(15030, 235, 'GLASS BEAKER WITH SPOUT LOW FORM 250ml ', 54.8, 10.275, '0.00', 54.8, 41.1, 0, 1, 0),
(15029, 235, 'PLASTIC BEAKER WITH SPOUT 500ML', 125.61, 23.5525, '0.00', 125.61, 94.21, 0, 1, 0),
(15028, 235, 'PLASTIC BEAKER WITH SPOUT 250ML', 97.43, 18.2675, '0.00', 97.43, 73.07, 0, 1, 0),
(15027, 235, 'PLASTIC MEASURING CYLINDER 2000ml ', 413.33, 77.5, '0.00', 413.33, 310, 0, 1, 0),
(15026, 235, 'GLASS MEASURING CYLINDER GRADE A 2000ml ', 1032, 193.5, '0.00', 1032, 774, 0, 1, 0),
(15050, 236, 'Embroidery', 33.33, 18750, '0.00', 100000, 25, 0, 3000, 0),
(15073, 237, 'Avery Dennison® Prismatic Reflective Tape for Road Cones 50mm x  47.5m', 866.67, 162.5, '0.00', 866.67, 650, 0, 1, 0),
(15074, 237, 'Avery Dennison® Prismatic Reflective Tape for Road Cones 75mm x  47.5m', 1226.67, 230, '0.00', 1226.67, 920, 0, 1, 0),
(15075, 237, 'Avery Dennison® Commercial Reflective Tape for Cones 150mm x 47.5m', 1533.33, 287.5, '0.00', 1533.33, 1150, 0, 1, 0),
(15076, 237, 'Avery Dennison® Commercial Reflective Tape for Cones 200mm x 47.5m', 2000, 375, '0.00', 2000, 1500, 0, 1, 0),
(15082, 238, 'Dromex Bunny Jacket Navy S-5XL', 640, 120, '0.00', 640, 480, 0, 1, 0),
(15081, 238, 'Beacon Jacket  Navy or Red-S- 5XL', 733.33, 137.5, '0.00', 733.33, 550, 0, 1, 0),
(15085, 239, 'Dromex Cotton Glove ', 4.23, 39.625, '0.00', 211.33, 3.17, 0, 50, 0),
(15092, 240, 'PVC Red Glove Open Cuff 40cm', 21, 20175.75, '0.00', 107604, 15.75, 0, 5124, 0),
(15117, 241, 'Dromex Rough Palm, Rolled Cuff, Shoulder 55cm length', 52.24, 117.54, '0.00', 626.88, 39.18, 0, 12, 0),
(15115, 241, 'Dromex Cotton Glove ', 4.23, 79.25, '0.00', 422.67, 3.17, 0, 100, 0),
(15116, 241, 'Rags/ kg', 21.01, 98.5, '0.00', 525.33, 15.76, 0, 25, 0),
(15114, 241, 'Blue lined  welding glove,elbow length 8', 73.33, 165, '0.00', 880, 55, 0, 12, 0),
(15113, 241, 'Dromex Dust Masks FFP2', 3.68, 69, '0.00', 368, 2.76, 0, 100, 0),
(15164, 242, 'Beard Covers White/100\'s', 48, 90, '0.00', 480, 36, 0, 10, 0),
(15163, 242, 'Mop Caps 18Inch Red/ 100\'s', 41.73, 78.25, '0.00', 417.33, 31.3, 0, 10, 0),
(15162, 242, 'Mop Caps 18Inch White/ 100\'s', 26.67, 50, '0.00', 266.67, 20, 0, 10, 0),
(15161, 242, 'Plastic Apron 100\'S 10 Microns Blue', 41.73, 78.25, '0.00', 417.33, 31.3, 0, 10, 0),
(15160, 242, 'Plastic Apron 100\'S 10 Microns White', 39.33, 73.75, '0.00', 393.33, 29.5, 0, 10, 0),
(15157, 242, 'Golden Hands Latex Powder Free Gloves- 100\'s', 88, 99, '0.00', 528, 66, 0, 6, 0),
(15158, 242, 'Dromex FFP1 Dust Masks ', 3.33, 37.5, '0.00', 200, 2.5, 0, 60, 0),
(15159, 242, '3 ply Disposable face Mask Blue Box of 50', 38, 7.125, '0.00', 38, 28.5, 0, 1, 0),
(15328, 243, 'PIONEER COMMANDER CHELEA BROWN SIZE 7', 466.67, 175, '0.00', 933.33, 350, 0, 2, 0),
(15327, 243, 'PIONEER COMMANDER CHELEA BLACK SIZE 11', 466.67, 175, '0.00', 933.33, 350, 0, 2, 0),
(15326, 243, 'PIONEER COMMANDER CHELEA BLACK SIZE 10', 466.67, 437.5, '0.00', 2333.33, 350, 0, 5, 0),
(15325, 243, 'PIONEER COMMANDER CHELEA BLACK SIZE 9', 466.67, 350, '0.00', 1866.67, 350, 0, 4, 0),
(15324, 243, 'PIONEER COMMANDER CHELEA BLACK SIZE 8', 466.67, 1137.5, '0.00', 6066.67, 350, 0, 13, 0),
(15320, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL 54', 360, 135, '0.00', 720, 270, 0, 2, 0),
(15323, 243, 'PIONEER COMMANDER CHELEA BLACK SIZE 7', 466.67, 437.5, '0.00', 2333.33, 350, 0, 5, 0),
(15322, 243, 'PIONEER COMMANDER CHELEA BLACK SIZE 6', 466.67, 262.5, '0.00', 1400, 350, 0, 3, 0),
(15321, 243, 'PIONEER COMMANDER CHELEA BLACK SIZE 5', 466.67, 87.5, '0.00', 466.67, 350, 0, 1, 0),
(15319, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 54', 360, 135, '0.00', 720, 270, 0, 2, 0),
(15318, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL 50', 360, 405, '0.00', 2160, 270, 0, 6, 0),
(15317, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 50', 360, 405, '0.00', 2160, 270, 0, 6, 0),
(15316, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL 5XL', 360, 135, '0.00', 720, 270, 0, 2, 0),
(15315, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 48', 360, 135, '0.00', 720, 270, 0, 2, 0),
(15312, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 44', 360, 1080, '0.00', 5760, 270, 0, 16, 0),
(15313, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL 4XL', 360, 405, '0.00', 2160, 270, 0, 6, 0),
(15314, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 46', 360, 405, '0.00', 2160, 270, 0, 6, 0),
(15311, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL 3XL', 360, 1080, '0.00', 5760, 270, 0, 16, 0),
(15310, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 42', 360, 945, '0.00', 5040, 270, 0, 14, 0),
(15309, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL 2XL', 360, 945, '0.00', 5040, 270, 0, 14, 0),
(15308, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 40', 360, 1350, '0.00', 7200, 270, 0, 20, 0),
(15307, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL XL', 360, 1350, '0.00', 7200, 270, 0, 20, 0),
(15306, 243, 'JONSSON VERSATEX REFLECTIVE WORK TROUSERS ROYAL 36', 360, 810, '0.00', 4320, 270, 0, 12, 0),
(15305, 243, 'JONSSON VERSATEX REFLECTIVE WORK JACKET ROYAL L', 360, 810, '0.00', 4320, 270, 0, 12, 0),
(15329, 243, 'DROMEX FLITE SNEAKER SIZE 9', 924, 173.25, '0.00', 924, 693, 0, 1, 0),
(15330, 243, 'DROMEX FLITE SNEAKER SIZE 10', 924, 173.25, '0.00', 924, 693, 0, 1, 0),
(15331, 243, 'DROMEX FLITE SNEAKER SIZE 12', 924, 173.25, '0.00', 924, 693, 0, 1, 0),
(15337, 246, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 150.67, 113, '0.00', 602.67, 113, 0, 4, 0),
(15336, 246, 'Dromex Spectacle EURO Clear adjustable Frame', 10.67, 30, '0.00', 160, 8, 0, 15, 0),
(15335, 246, 'Dromex Lime or Orange Reflective Vest with Zip & ID S- 5XL (No 4XL)', 32, 120, '0.00', 640, 24, 0, 20, 0),
(15384, 247, 'Dromex D59 Flame and Acid Resistant  with Tape Jacket All Sizes', 250, 46.875, '0.00', 250, 187.5, 0, 1, 0),
(15385, 247, 'Dromex D59 Flame and Acid Resistant with Tape Pants All Sizes', 250, 46.875, '0.00', 250, 187.5, 0, 1, 0),
(15386, 247, 'DROMEX All COLOURS DUST COAT', 160, 30, '0.00', 160, 120, 0, 1, 0),
(15383, 247, 'Bova Shoe - Radical - 60001', 512, 96, '0.00', 512, 384, 0, 1, 0),
(15382, 247, 'Bova Boot - Neo-Flex - 90004', 640, 120, '0.00', 640, 480, 0, 1, 0),
(15380, 247, 'Bova Boot - Maverick - 60002', 540, 101.25, '0.00', 540, 405, 0, 1, 0),
(15381, 247, 'Bova Boot - Welders - 42004', 1000, 187.5, '0.00', 1000, 750, 0, 1, 0),
(15378, 247, 'Bova  Chelsea - 90006  ', 938, 175.875, '0.00', 938, 703.5, 0, 1, 0),
(15379, 247, 'Sisi- Sydney - 51005 Black or Brown', 640, 120, '0.00', 640, 480, 0, 1, 0),
(15428, 248, 'Dromex Ear Plug Tri Flange, Reusable -Corded', 2.67, 100, '0.00', 533.33, 2, 0, 200, 0),
(15427, 248, 'Dromex Yellow household Glove with Flock Liner', 7.4, 27.75, '0.00', 148, 5.55, 0, 20, 0),
(15425, 248, 'Dromex Chrome leather double palm elbow length 8', 40, 90, '0.00', 480, 30, 0, 12, 0),
(15426, 248, 'Dromex Chrome leather double palm  wrist length 2.5', 32, 72, '0.00', 384, 24, 0, 12, 0),
(15424, 248, 'FFP1 Dust Mask  SABS Approved', 3.2, 120, '0.00', 640, 2.4, 0, 200, 0),
(15451, 249, 'DROMEX Navy CONTI SUIT Sizes 42', 186.67, 140, '0.00', 746.67, 140, 0, 4, 0),
(15452, 249, 'DROMEX Navy CONTI SUIT Sizes 44', 186.67, 420, '0.00', 2240, 140, 0, 12, 0),
(15453, 249, 'DROMEX Navy CONTI SUIT Sizes 50', 186.67, 70, '0.00', 373.33, 140, 0, 2, 0),
(15454, 249, 'DROMEX BOXER BLACK SAFETY SHOE, Size 7', 273.33, 358.75, '0.00', 1913.33, 205, 0, 7, 0),
(15455, 249, 'DROMEX BOXER BLACK SAFETY SHOE, Size 8', 273.33, 102.5, '0.00', 546.67, 205, 0, 2, 0),
(15458, 249, 'DUCTECH LOGO EMBROIDERY (A4 BACK ONLY)', 44, 231, '0.00', 1232, 33, 0, 28, 0),
(15457, 249, 'DROMEX BOXER BLACK SAFETY SHOE, Size 10', 273.33, 51.25, '0.00', 273.33, 205, 0, 1, 0),
(15456, 249, 'DROMEX BOXER BLACK SAFETY SHOE, Size 9', 273.33, 102.5, '0.00', 546.67, 205, 0, 2, 0),
(15450, 249, 'DROMEX Navy CONTI SUIT Sizes 40', 186.67, 210, '0.00', 1120, 140, 0, 6, 0),
(15449, 249, 'DROMEX Navy CONTI SUIT Sizes 38', 186.67, 140, '0.00', 746.67, 140, 0, 4, 0),
(15470, 250, 'Dromex Wihite CONTI SUIT Size  44', 188.69, 247.66, '0.00', 1320.85, 141.52, 0, 7, 0),
(15469, 250, 'Dromex Wihite CONTI SUIT Size  40', 188.69, 318.42, '0.00', 1698.24, 141.52, 0, 9, 0),
(15468, 250, 'Dromex Wihite CONTI SUIT Size  38', 188.69, 70.76, '0.00', 377.39, 141.52, 0, 2, 0),
(15467, 250, 'Dromex Wihite CONTI SUIT Size  34', 188.69, 141.52, '0.00', 754.77, 141.52, 0, 4, 0),
(15475, 251, 'Dromex Cotton Glove ', 4.23, 39.65625, '0.00', 211.5, 3.1725, 0, 50, 0),
(15476, 251, 'DROMEX Category III Viper chemical glove ', 44.67, 418.78125, '0.00', 2233.5, 33.5025, 0, 50, 0),
(15477, 252, 'Kidney Belt  S- 2XL', 92.01, 69.00999999999999, '0.00', 368.05, 69.01, 0, 4, 0),
(15478, 252, 'Full Body Harness', 325.92, 244.44000000000005, '0.00', 1303.68, 244.44, 0, 4, 0),
(15493, 253, 'DROMEX BOXER BLACK SAFETY BOOT', 266.67, 50, '0.00', 266.67, 200, 0, 1, 0),
(15492, 253, 'Polycotton Conti suits Royal Blue size 28-44', 113.33, 21.25, '0.00', 113.33, 85, 0, 1, 0),
(15491, 253, 'Denim Coni suit size 28-44', 213.33, 40, '0.00', 213.33, 160, 0, 1, 0),
(15490, 253, 'Dromex Chrome leather double palm elbow length 8', 40, 7.5, '0.00', 40, 30, 0, 1, 0),
(15489, 253, 'Dromex Chrome leather double palm  wrist length 2.5', 30.67, 5.75, '0.00', 30.67, 23, 0, 1, 0),
(15488, 253, 'Dromex PVC Red Glove Knit Wrist', 11, 2.0625, '0.00', 11, 8.25, 0, 1, 0),
(15487, 253, 'Safety Hard Hat White', 17.33, 3.25, '0.00', 17.33, 13, 0, 1, 0),
(15494, 253, 'Face Shield clear complete', 39.87, 7.475, '0.00', 39.87, 29.9, 0, 1, 0),
(15495, 253, 'Royal Blue Dust Coat S-4XL', 100, 18.75, '0.00', 100, 75, 0, 1, 0),
(15496, 253, 'Dromex PVC Rubberised Rain Suit Navy S- 4XL', 120, 22.5, '0.00', 120, 90, 0, 1, 0),
(15497, 253, 'Blue Reflective Vest with Zip & ID S- 3XL', 41.33, 7.75, '0.00', 41.33, 31, 0, 1, 0),
(15498, 253, 'Dromex Lime Reflective Vest with Zip & ID S-5XL', 32, 6, '0.00', 32, 24, 0, 1, 0),
(15499, 253, 'Dromex Ear Plug Tri Flange, Reusable', 2.67, 100, '0.00', 533.33, 2, 0, 200, 0),
(15500, 253, 'Ear Muff', 21.33, 4, '0.00', 21.33, 16, 0, 1, 0),
(15501, 253, 'Dromex Spectacle EURO Clear adjustable Frame', 10.67, 2, '0.00', 10.67, 8, 0, 1, 0),
(15502, 253, 'Dromex Spectacle EURO Green adjustable Frame', 10.67, 2, '0.00', 10.67, 8, 0, 1, 0),
(15845, 254, 'ICE SCOOP S/S RND L110xB65mm(32mm DEEP)HANDLE 80mm', 58.67, 11, '0.00', 58.67, 44, 0, 1, 0),
(15844, 254, 'ICE SCOOP S/S RND L130xB82mm(40mm DEEP)HANDLE 90mm', 72, 13.5, '0.00', 72, 54, 0, 1, 0),
(15843, 254, 'ICE SCOOP S/S RND L150xB90mm(41mm DEEP)HANDLE 90mm', 93.33, 17.5, '0.00', 93.33, 70, 0, 1, 0),
(15842, 254, 'ICE SCOOP S/S RND L175xB111mm(45mm DEEP)HANDLE 100', 120, 22.5, '0.00', 120, 90, 0, 1, 0),
(15841, 254, 'ICE SCOOP S/S RND L200xB122mm(58mm DEEP)HANDLE 106', 146.67, 27.5, '0.00', 146.67, 110, 0, 1, 0),
(15840, 254, 'ICE SCOOP S/STEEL ROUND L220 X R145MM (70MM DEEP)', 173.33, 32.5, '0.00', 173.33, 130, 0, 1, 0),
(15839, 254, 'ICE SCOOP S/S RND L255xB185mm(73mm DEEP)HANDLE 130', 240, 45, '0.00', 240, 180, 0, 1, 0),
(15838, 254, 'ICE SCOOP S/S SQ L155xB106mm(44mm DEEP)HANDLE 90mm', 122.67, 23, '0.00', 122.67, 92, 0, 1, 0),
(15837, 254, 'ICE SCOOP S/S SQ L175xB124mm(51mm DEEP)HANDLE 100', 157.33, 29.5, '0.00', 157.33, 118, 0, 1, 0),
(15836, 254, 'ICE SCOOP S/S SQ L195xB138mm(54mm DEEP)HANDLE 105', 180, 33.75, '0.00', 180, 135, 0, 1, 0),
(15835, 254, 'ICE SCOOP S/S SQ L250xB187mm(66mmDEEP) HANDLE 130 ', 333.33, 62.5, '0.00', 333.33, 250, 0, 1, 0),
(15517, 255, 'Wire Nails 75mm / kg', 46, 43.125, '0.00', 230, 34.5, 0, 5, 0),
(15516, 255, 'Citronol Hand Cleaner with grit 30 Kg', 760, 142.5, '0.00', 760, 570, 0, 1, 0),
(15531, 256, 'Dromex Black PU palm coated on black knitted shell', 10.67, 2, '0.00', 10.67, 8, 0, 1, 0),
(15529, 256, 'Leather Apron, 60 x 120,Seamless', 132.53, 24.85, '0.00', 132.53, 99.4, 0, 1, 0),
(15530, 256, 'Dromex Crayfish Gloves', 11.72, 2.1975, '0.00', 11.72, 8.79, 0, 1, 0),
(15528, 256, 'Leather Apron, 60 x 90,Seamless', 115.87, 21.725, '0.00', 115.87, 86.9, 0, 1, 0),
(15527, 256, 'FFP1 Dust Mask SABS Approved (Sold in Boxes of 20)', 2.95, 11.05, '0.00', 58.93, 2.21, 0, 20, 0),
(15556, 257, 'DROMEX BOXER CHELSEA BOOT BLACK, SIZE 3', 480, 90, '0.00', 480, 360, 0, 1, 0),
(15557, 257, 'DROMEX BOXER CHELSEA BOOT BLACK, SIZE 10', 480, 90, '0.00', 480, 360, 0, 1, 0),
(15558, 257, 'Dromex D59 Flame and Acid Pants  Size 30', 296, 111, '0.00', 592, 222, 0, 2, 0),
(15559, 257, 'Dromex D59 Flame and Acid Pants Size 34', 296, 111, '0.00', 592, 222, 0, 2, 0),
(15560, 257, 'Dromex D59 Flame and Acid Jacket Size 36', 296, 222, '0.00', 1184, 222, 0, 4, 0),
(15712, 258, 'DROMEX AGRIMac JACKET, XLARGE', 373.33, 140, '0.00', 746.67, 280, 0, 2, 0),
(15713, 258, 'DROMEX AGRIMac BIB PANTS, XLARGE', 293.33, 110, '0.00', 586.67, 220, 0, 2, 0),
(15711, 258, 'Ear Muff', 24, 67.5, '0.00', 360, 18, 0, 15, 0),
(15707, 258, 'Lp gas  blow torch 190g 6ea', 40, 60, '0.00', 320, 30, 0, 8, 0),
(15708, 258, 'BROOM MTS HOUSEHOLD BRITE', 87.33, 245.625, '0.00', 1310, 65.5, 0, 15, 0),
(15709, 258, 'Safety Hard Cap Blue', 17, 19.125, '0.00', 102, 12.75, 0, 6, 0),
(15710, 258, 'P2 Cartridges (Dust Cartridge)', 50.67, 285, '0.00', 1520, 38, 0, 30, 0),
(15587, 259, 'Artwork (Once off)', 180, 33.75, '0.00', 180, 135, 0, 1, 0),
(15586, 259, 'Restricted Area sign - ABS + print ', 186.67, 175, '0.00', 933.33, 140, 0, 5, 0),
(15591, 260, 'Rags/ kg', 16.8, 78.75, '0.00', 420, 12.6, 0, 25, 0),
(15590, 260, 'DROMEX UTILITY PANTS CA-CARBON , SIZE 28', 594.15, 111.4025, '0.00', 594.15, 445.61, 0, 1, 0),
(15706, 258, 'Dromex Cotton Glove ', 3.87, 217.5, '0.00', 1160, 2.9, 0, 300, 0),
(15733, 261, 'Black Black Gumboot NSTC Size 12', 120, 45, '0.00', 240, 90, 0, 2, 0),
(15732, 261, 'Black Black Gumboot NSTC Size 11', 120, 45, '0.00', 240, 90, 0, 2, 0),
(15731, 261, 'Black Black Gumboot NSTC Size 10', 120, 90, '0.00', 480, 90, 0, 4, 0),
(15730, 261, 'Black Black Gumboot NSTC Size 9', 120, 90, '0.00', 480, 90, 0, 4, 0),
(15729, 261, 'Black Black Gumboot NSTC Size 8', 120, 90, '0.00', 480, 90, 0, 4, 0),
(15728, 261, 'Black Black Gumboot NSTC Size 7', 120, 90, '0.00', 480, 90, 0, 4, 0),
(15724, 261, 'Dromex Spectacle EURO Clear adjustable Frame', 10.67, 96, '0.00', 512, 8, 0, 48, 0),
(15725, 261, 'Dromex Spectacle EURO Green adjustable Frame', 10.67, 24, '0.00', 128, 8, 0, 12, 0),
(15726, 261, 'Face Shield clear complete', 39.87, 149.5, '0.00', 797.33, 29.9, 0, 20, 0),
(15727, 261, 'Black Black Gumboot NSTC Size 6', 120, 90, '0.00', 480, 90, 0, 4, 0),
(15720, 261, 'GRIPPER SEAMLESS YELLOW SHELL - CRINKLE RUBBER PALM COATED( (Handling Glove)', 11, 247.5, '0.00', 1320, 8.25, 0, 120, 0),
(15721, 261, 'FFP2 Dust Mask SABS Approved', 3, 225, '0.00', 1200, 2.25, 0, 400, 0),
(15722, 261, 'Dromex Ear Plug Tri Flange, Reusable', 2.67, 200, '0.00', 1066.67, 2, 0, 400, 0),
(15723, 261, 'Dromex Cut Resistant Glove Level 5 (Black Coated))', 53.33, 480, '0.00', 2560, 40, 0, 48, 0),
(15716, 261, 'Dromex PVC Red Glove Knit Wrist', 11, 618.75, '0.00', 3300, 8.25, 0, 300, 0),
(15717, 261, 'PVC Red Glove Open Cuff 40cm (Special)', 19, 534.375, '0.00', 2850, 14.25, 0, 150, 0),
(15718, 261, 'Dromex Chrome leather double palm elbow length 8', 40, 750, '0.00', 4000, 30, 0, 100, 0),
(15719, 261, 'Dromex Black PU palm coated on black knitted shell', 10.67, 240, '0.00', 1280, 8, 0, 120, 0),
(15705, 258, 'Rags/ kg (July Spcial)', 16.8, 157.5, '0.00', 840, 12.6, 0, 50, 0),
(15715, 262, 'HAND SOAP ANTI-BAC BERRIES 25L ', 320, 60, '0.00', 320, 240, 0, 1, 0),
(15780, 263, 'P2 Cartridges (Dust Cartridge)', 50.67, 190, '0.00', 1013.33, 38, 0, 20, 0),
(15884, 264, 'Rags/ kg', 16.8, 78.75, '0.00', 420, 12.6, 0, 25, 0),
(15883, 264, 'DROMEX UTILITY PANTS CA-CARBON , SIZE 28', 594.15, 111.4025, '0.00', 594.15, 445.61, 0, 1, 0),
(15882, 264, 'DROMEX BOXER CHELSEA BOOT BLACK, SIZE 9', 480, 90, '0.00', 480, 360, 0, 1, 0),
(15881, 264, 'DROMEX BOXER CHELSEA BOOT BLACK, SIZE 7', 480, 90, '0.00', 480, 360, 0, 1, 0),
(15880, 264, 'Dromex D59 Flame and Acid Pants Size 38', 296, 111, '0.00', 592, 222, 0, 2, 0),
(15879, 264, 'Dromex D59 Flame and Acid Pants Size 30', 296, 111, '0.00', 592, 222, 0, 2, 0),
(15878, 264, 'Dromex D59 Flame and Acid Jacket Size 46', 296, 111, '0.00', 592, 222, 0, 2, 0),
(15779, 263, 'Green PVC Apron Heavy Duty ', 34.68, 65.0175, '0.00', 346.76, 26.007, 0, 10, 0),
(15778, 263, 'Bata Gumboots NTSC Size 8', 152.67, 57.2525, '0.00', 305.35, 114.505, 0, 2, 0),
(15781, 263, 'Safety Hard Cap Blue', 17, 22.31425, '0.00', 119.01, 12.751, 0, 7, 0),
(15783, 265, 'Bova Jarman Shoe - 70003/77003 Size 10 (No stock -  It\'s a made to order)', 864.27, 162.05, '0.00', 864.27, 648.2, 0, 1, 0),
(15788, 266, 'HD07, Trident 2,5kW S/S Hand Dryer w/ Swivel Nozzle ', 2586.73, 485.0125, '0.00', 2586.73, 1940.05, 0, 1, 0),
(15789, 266, 'HD05, Hand Dryer GT 1.8Kw - Plastic White ', 1400, 262.5, '0.00', 1400, 1050, 0, 1, 0),
(15814, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 44', 266.67, 50, '0.00', 266.67, 200, 0, 1, 0),
(15813, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 43', 266.67, 150, '0.00', 800, 200, 0, 3, 0),
(15812, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 42', 266.67, 250, '0.00', 1333.33, 200, 0, 5, 0),
(15811, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 41', 266.67, 150, '0.00', 800, 200, 0, 3, 0),
(15810, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 40', 266.67, 250, '0.00', 1333.33, 200, 0, 5, 0),
(15809, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 39', 266.67, 50, '0.00', 266.67, 200, 0, 1, 0),
(15808, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 38', 266.67, 100, '0.00', 533.33, 200, 0, 2, 0),
(15807, 267, 'DROMEX BOXER BLACK SAFETY BOOT Size 37', 266.67, 50, '0.00', 266.67, 200, 0, 1, 0),
(15877, 264, 'Dromex D59 Flame and Acid Jacket Size 36', 296, 111, '0.00', 592, 222, 0, 2, 0),
(15866, 268, 'HAND SOAP ANTI-BAC BERRIES 5L', 70, 26.25, '0.00', 140, 52.5, 0, 2, 0),
(15867, 268, 'URINAL PELLETS 20G - 5KG PINK', 275, 51.56325, '0.00', 275, 206.253, 0, 1, 0),
(15864, 268, '25l Degreaser Pink', 350, 65.625, '0.00', 350, 262.5, 0, 1, 0),
(15865, 268, 'DROMEX Brown rough PVC gloves, 35cm elbow', 40, 112.5, '0.00', 600, 30, 0, 15, 0),
(15885, 264, 'Boot - ELLA Daisy Chelsea - Ladies - 7014 Size 2', 635.2, 119.1, '0.00', 635.2, 476.4, 0, 1, 0),
(15911, 269, 'Delivery Fee', 150, 28.125, '0.00', 150, 112.5, 0, 1, 0),
(15910, 269, 'Leather Apron, 60 x 90,Seamless', 128, 48, '0.00', 256, 96, 0, 2, 0),
(16040, 270, 'Your Safety , our priority Embroided', 24, 13.5, '0.00', 72, 18, 0, 3, 0),
(16041, 270, 'Names Embroided', 18.67, 10.5, '0.00', 56, 14, 0, 3, 0),
(16038, 270, 'Navy / yellow Vented Reflective Mining Shirt  L', 330.67, 186, '0.00', 992, 248, 0, 3, 0),
(16039, 270, 'Trencon Logo at the Back Embroided', 46.67, 26.25, '0.00', 140, 35, 0, 3, 0),
(15907, 271, 'ICE SCOOP S/S SQ L250xB187mm(70mm DEEP) HANDLE 130 ', 333.33, 375, '0.00', 2000, 250, 0, 6, 0),
(15906, 271, 'ICE SCOOP S/S RND L255xB185mm(80mm DEEP)HANDLE 130', 240, 270, '0.00', 1440, 180, 0, 6, 0),
(15918, 272, 'Rags/ kg', 20, 187.5, '0.00', 1000, 15, 0, 50, 0),
(15917, 272, 'Dromex Clear mono goggle direct vent', 12, 13.5, '0.00', 72, 9, 0, 6, 0),
(15916, 272, 'Dromex Spectacle EURO Clear adjustable Frame', 12, 27, '0.00', 144, 9, 0, 12, 0),
(15919, 272, 'Lp gas 190g', 40, 45, '0.00', 240, 30, 0, 6, 0),
(15983, 273, 'FEATHER DUSTER - LONG 1840mm', 92, 17.25, '0.00', 92, 69, 0, 1, 0),
(15982, 273, 'FEATHER DUSTER - MEDIUM 900mm', 78.67, 14.75, '0.00', 78.67, 59, 0, 1, 0),
(15981, 273, 'PROMOP 300gr JUMBO MOP - METAL SOCKET 22mm - PINE HANDLE', 40, 7.5, '0.00', 40, 30, 0, 1, 0),
(15980, 273, 'PROMOP 400gr DROP MOP - METAL SOCKET 25mm - PINE HANDLE', 48, 9, '0.00', 48, 36, 0, 1, 0),
(15976, 273, 'HAND SOAP ANTI-BAC BERRIES 25L ', 320, 60, '0.00', 320, 240, 0, 1, 0),
(15979, 273, '600mm METAL FLOOR SQUEEGEES', 200, 37.5, '0.00', 200, 150, 0, 1, 0),
(15978, 273, 'ARROW 600MM (24 INCH) PLATFORM BROOM - SOFT PVC', 92, 17.25, '0.00', 92, 69, 0, 1, 0),
(15977, 273, 'ARROW 600MM (24 INCH) PLATFORM BROOM - HARD PVC', 92, 17.25, '0.00', 92, 69, 0, 1, 0),
(16437, 288, 'Scotch Brite Green Pads 150 x 225 (Pack of 10)', 162.21, 60.83, '0.00', 324.43, 121.66, 0, 2, 0),
(16553, 274, '9 Can Wave Design Cooler - Size: 20,5 x 25 x 15,5cm', 37.33, 3150, '0.00', 16800, 28, 0, 450, 0),
(16554, 274, '12 Can Cooler with 2 Exterior Pockets 70D PEVA Lining- Size: 22 x 26.5 x 17cm', 93.33, 875, '0.00', 4666.67, 70, 0, 50, 0),
(16555, 274, 'Printing On bags A6 Size', 28, 2625, '0.00', 14000, 21, 0, 500, 0),
(16004, 275, 'Oil Test Kit Refill (40\'s)', 733.33, 137.5, '0.00', 733.33, 550, 0, 1, 0),
(16030, 276, 'Conti suits White size 36 Jacket/ 32 Pants', 134.67, 50.5, '0.00', 269.33, 101, 0, 2, 0),
(16031, 276, 'Conti suits White size 38 Jacket/ 34 Pants', 134.67, 75.75, '0.00', 404, 101, 0, 3, 0),
(16033, 276, 'Conti suits Royal Blue size 38 Jacket/ 34 Pants', 134.67, 75.75, '0.00', 404, 101, 0, 3, 0),
(16032, 276, 'Conti suits Royal Blue size 36 Jacket/ 32 Pants', 134.67, 50.5, '0.00', 269.33, 101, 0, 2, 0),
(16135, 278, 'Black Black Gumboot NSTC Size 9', 120, 90, '0.00', 480, 90, 0, 4, 0),
(16075, 277, 'DROMEX AGRIMac JACKET, XLARGE', 373.33, 140, '0.00', 746.67, 280, 0, 2, 0),
(16076, 277, 'DROMEX AGRIMac BIB PANTS, XLARGE', 279.84, 104.94, '0.00', 559.68, 209.88, 0, 2, 0),
(16074, 277, 'Rags/ kg', 20.67, 193.75, '0.00', 1033.33, 15.5, 0, 50, 0),
(16070, 277, 'Red heat resistant apron palm welding glove,', 57.47, 129.3, '0.00', 689.6, 43.1, 0, 12, 0),
(16071, 277, 'Citronol Hand Cleaner with grit 30 Kg', 740, 138.75, '0.00', 740, 555, 0, 1, 0),
(16072, 277, 'Long clear visor ', 40.99, 76.85, '0.00', 409.87, 30.74, 0, 10, 0),
(16073, 277, 'ALUMINIUM CAP ATTACHMENT FOR HARD HAT', 93.33, 175, '0.00', 933.33, 70, 0, 10, 0),
(16136, 278, 'Black Black Gumboot NSTC Size 10', 120, 90, '0.00', 480, 90, 0, 4, 0),
(16134, 278, 'Black Black Gumboot NSTC Size 8', 120, 90, '0.00', 480, 90, 0, 4, 0),
(16133, 278, 'Black Black Gumboot NSTC Size 7', 120, 90, '0.00', 480, 90, 0, 4, 0),
(16132, 278, 'Black Black Gumboot NSTC Size 6', 120, 90, '0.00', 480, 90, 0, 4, 0),
(16131, 278, 'Dromex Spectacle EURO Green adjustable Frame', 10.67, 24, '0.00', 128, 8, 0, 12, 0),
(16128, 278, 'Dromex Ear Plug Tri Flange, Reusable', 2.67, 100, '0.00', 533.33, 2, 0, 200, 0),
(16130, 278, 'Dromex Spectacle EURO Clear adjustable Frame', 10.67, 96, '0.00', 512, 8, 0, 48, 0),
(16129, 278, 'Dromex Cut Resistant Glove Level 5 (Black Coated)', 53.33, 480, '0.00', 2560, 40, 0, 48, 0),
(16127, 278, 'FFP2 Dust Mask SABS Approved', 3, 225, '0.00', 1200, 2.25, 0, 400, 0),
(16126, 278, 'GRIPPER SEAMLESS YELLOW SHELL - CRINKLE RUBBER PALM COATED( (Handling Glove)', 11, 247.5, '0.00', 1320, 8.25, 0, 120, 0),
(16124, 278, 'Dromex Chrome leather double palm elbow length 8inch', 40, 450, '0.00', 2400, 30, 0, 60, 0),
(16125, 278, 'Dromex Black PU palm coated on black knitted shell', 10.67, 240, '0.00', 1280, 8, 0, 120, 0),
(16123, 278, 'PVC Red Glove Open Cuff 40cm ', 26.99, 759, '0.00', 4048, 20.24, 0, 150, 0),
(16122, 278, 'Dromex PVC Red Glove Knit Wrist', 11, 618.75, '0.00', 3300, 8.25, 0, 300, 0),
(16145, 279, 'Dromex Cotton Glove ', 4.8, 45, '0.00', 240, 3.6, 0, 50, 0),
(16146, 279, 'DROMEX Category III chemical glove', 56, 525, '0.00', 2800, 42, 0, 50, 0),
(16177, 281, 'Dromex Spectacle EURO Clear adjustable Frame', 11.31, 212, '0.00', 1130.67, 8.48, 0, 100, 0),
(16176, 281, 'IN-DIRECT ULTIMATE VISION, WIDE BAND ELASTIC GOGGLES', 70.17, 131.575, '0.00', 701.73, 52.63, 0, 10, 0),
(16175, 281, 'FFP2 Dust Mask SABS Approved', 3.67, 275, '0.00', 1466.67, 2.75, 0, 400, 0),
(16213, 283, 'AQA Drink1 F/Stdg Cold and Ambient Direct connection Water Dispenser', 4666.67, 875, '0.00', 4666.67, 3500, 0, 1, 0),
(16212, 282, 'Dromex PVC Rubberised Rain Suit Navy L', 120, 90, '0.00', 480, 90, 0, 4, 0),
(16211, 282, 'FEATHER DUSTER - LONG 1840mm', 95.2, 35.7, '0.00', 190.4, 71.4, 0, 2, 0),
(16210, 282, 'FEATHER DUSTER - MEDIUM 900mm', 82.67, 31, '0.00', 165.33, 62, 0, 2, 0),
(16209, 282, '3M 6059,Cartridge - ABEK1 -Chemical', 213.33, 320, '0.00', 1706.67, 160, 0, 8, 0),
(16208, 282, '3M 6300,Half Mask (Facepiece)', 334.67, 251, '0.00', 1338.67, 251, 0, 4, 0),
(16214, 283, 'Water Filter RC Inline Refrigerator Cartridge Cl+ 8500L with Pressure Reducing Valve', 2400, 450, '0.00', 2400, 1800, 0, 1, 0),
(16226, 284, 'Dromex Demin Jean Pants- 5 Pockets Size 34', 297.85, 167.5425, '0.00', 893.56, 223.39, 0, 3, 0),
(16224, 284, 'Dromex Grey Conti Suit With Reflectors Size  36', 210.52, 78.945, '0.00', 421.04, 157.89, 0, 2, 0),
(16225, 284, 'Dromex Demin Jean Pants- 5 Pockets Size 32', 297.85, 111.695, '0.00', 595.71, 223.39, 0, 2, 0),
(16223, 284, 'Dromex Grey Conti Suit With Reflectors Size  34', 210.52, 78.945, '0.00', 421.04, 157.89, 0, 2, 0),
(16244, 285, 'Embroidery 2025 on Pants', 18.67, 24.5, '0.00', 130.67, 14, 0, 7, 0),
(16243, 285, 'Embroidery - INGALA INSULATION- NUMBER Left Chest', 21.33, 28, '0.00', 149.33, 16, 0, 7, 0),
(16241, 285, 'Royal Blue Conti Suit 80/20 With reflectors on Arms and Legs Size 42 pants/ 46 Jacket', 213.33, 80, '0.00', 426.67, 160, 0, 2, 0),
(16242, 285, 'Royal Blue Conti Suit 80/20  With reflectors on Arms and Legs Size 48 pants/ 52 Jacket', 240, 45, '0.00', 240, 180, 0, 1, 0),
(16240, 285, 'Royal Blue Conti Suit 80/20 With reflectors on Arms and Legs Size 40 pants/ 44 Jacket', 210, 78.75, '0.00', 420, 157.5, 0, 2, 0),
(16239, 285, 'Royal Blue Conti Suit 80/20 With reflectors on Arms and Legs Size 30 pants/ 34 Jacket', 210, 78.75, '0.00', 420, 157.5, 0, 2, 0),
(16295, 286, 'Conti suits 80/20 Royal Blue size 50 Pants/54 Jacket', 216.67, 40.625, '0.00', 216.67, 162.5, 0, 1, 0),
(16294, 286, 'Conti suits 80/20 Royal Blue size 48 Pants/52 Jacket', 208, 39, '0.00', 208, 156, 0, 1, 0),
(16293, 286, 'Conti suits 80/20 Royal Blue size 46 Pants/50 Jacket', 198.67, 37.25, '0.00', 198.67, 149, 0, 1, 0),
(16292, 286, 'Conti suits 80/20 Royal Blue size 44 Pants/48 Jacket', 190.67, 35.75, '0.00', 190.67, 143, 0, 1, 0),
(16291, 286, 'Conti suits 80/20 Royal Blue size 42 Pants/46 Jacket', 181.6, 34.05, '0.00', 181.6, 136.2, 0, 1, 0),
(16290, 286, 'Conti suits 80/20 Royal Blue size 40 Pants/44 Jacket', 173.6, 32.55, '0.00', 173.6, 130.2, 0, 1, 0),
(16289, 286, 'Conti suits 80/20 Royal Blue size 38 Pants/42 Jacket', 173.6, 32.55, '0.00', 173.6, 130.2, 0, 1, 0),
(16288, 286, 'Conti suits 80/20 Royal Blue size 36 Pants/40 Jacket', 173.6, 32.55, '0.00', 173.6, 130.2, 0, 1, 0),
(16287, 286, 'Conti suits 80/20 Royal Blue size 34 Pants/38 Jacket', 173.6, 32.55, '0.00', 173.6, 130.2, 0, 1, 0),
(16286, 286, 'Conti suits 80/20 Royal Blue size 32 Pants/36 Jacket', 173.6, 32.55, '0.00', 173.6, 130.2, 0, 1, 0),
(16285, 286, 'Conti suits 80/20 Royal Blue size 30 Pants/34 Jacket', 173.6, 32.55, '0.00', 173.6, 130.2, 0, 1, 0),
(16302, 287, '3M Diamond Grade Conspicuity Vehicle Markings 983-10 White, Edge Sealed ECE 104 Maked 100mmx45.7M** Special order', 3600, 675, '0.00', 3600, 2700, 0, 1, 0),
(16301, 287, '3M Diamond Grade Conspicuity Vehicle Markings 983-10 WHite, Edge Sealed ECE 104 MAked 53.5mmx50M** Special order', 2000, 375, '0.00', 2000, 1500, 0, 1, 0),
(16436, 288, 'BATTERY DURACELL PLUS 9V B1', 120, 135, '0.00', 720, 90, 0, 6, 0),
(16434, 288, 'Platform Broom Soft 450mm', 80, 150, '0.00', 800, 60, 0, 10, 0),
(16435, 288, 'Varta Industrial AA (Pack of 10)', 107.2, 201, '0.00', 1072, 80.4, 0, 10, 0),
(16433, 288, 'House Hold Broom Soft ', 35, 65.625, '0.00', 350, 26.25, 0, 10, 0);
INSERT INTO `tb_quote_items` (`item_id`, `item_quote_id`, `item_product`, `item_price`, `item_profit`, `item_discount`, `item_subtotal`, `item_cost`, `item_supplier_id`, `item_qty`, `item_vat`) VALUES
(16432, 288, 'P2 Cartridges (Dust Cartridge)', 51.07, 191.5, '0.00', 1021.33, 38.3, 0, 20, 0),
(16429, 288, 'Dromex Dust Mask SABS Approved (Comes In a Box of 20)', 3.43, 38.55, '0.00', 205.6, 2.57, 0, 60, 0),
(16431, 288, 'Chrome Leather Knee Spats ', 120, 112.5, '0.00', 600, 90, 0, 5, 0),
(16430, 288, 'Rags/ kg', 17, 159.375, '0.00', 850, 12.75, 0, 50, 0),
(16428, 289, 'Fire Extinguisher ABS Sign 190 x 190', 52, 9.75, '0.00', 52, 39, 0, 1, 0),
(16427, 289, 'Used Oil Sign ABS 400 x400', 93.33, 17.5, '0.00', 93.33, 70, 0, 1, 0),
(16426, 289, 'Single Cartridge Half Mask', 85.33, 16, '0.00', 85.33, 64, 0, 1, 0),
(16425, 289, 'Dromex SABS D59 Flame/Acid Pants All Sizes', 266.67, 50, '0.00', 266.67, 200, 0, 1, 0),
(16424, 289, 'Dromex SABS D59 Flame/Acid Jacket All Sizes', 266.67, 50, '0.00', 266.67, 200, 0, 1, 0),
(16388, 290, 'Chemplus logo Embroided From left Chest', 29.33, 165, '0.00', 880, 22, 0, 30, 0),
(16387, 290, 'Logo Digitizing (Once Off)', 200, 37.5, '0.00', 200, 150, 0, 1, 0),
(16386, 290, 'Dromex Lime Reflective Vest with Zip & ID S-XL', 34, 191.25, '0.00', 1020, 25.5, 0, 30, 0),
(16423, 289, 'Dromex HOOD D59 Flame/Acid Weld Hood', 213.33, 40, '0.00', 213.33, 160, 0, 1, 0),
(16421, 289, 'Chrome Leather Yoke L-2XL', 186.67, 35, '0.00', 186.67, 140, 0, 1, 0),
(16422, 289, 'Chrome Leather Yoke 3XL-4XL', 226.67, 42.5, '0.00', 226.67, 170, 0, 1, 0),
(16445, 291, 'Boot - ELLA Jasmine Nubuck - Ladies - 7015 Size 4', 588.8, 110.4, '0.00', 588.8, 441.6, 0, 1, 0),
(16444, 291, 'Boot - ELLA Daisy Chelsea - Ladies - 7014  Size 4', 635.2, 119.1, '0.00', 635.2, 476.4, 0, 1, 0),
(16478, 293, 'PROMAX white Disposable Coveralls, Small to 3XL', 67.25, 12.61, '0.00', 67.25, 50.44, 0, 1, 0),
(16456, 292, 'GAS CARTRIDGE 190G OXY BUTANE ', 46.93, 52.8, '0.00', 281.6, 35.2, 0, 6, 0),
(16455, 292, 'Wire Nails 100mm / kg', 42.67, 40, '0.00', 213.33, 32, 0, 5, 0),
(16477, 293, 'NITRIFLEX Black Sanitized PALM nitrile coated', 33.33, 6.25, '0.00', 33.33, 25, 0, 1, 0),
(16475, 293, 'FFP2 Dust Mask SABS Approved (Carton)', 3.72, 279, '0.00', 1488, 2.79, 0, 400, 0),
(16476, 293, 'Cotton Knitted Gloves', 3.77, 0.7075, '0.00', 3.77, 2.83, 0, 1, 0),
(16552, 294, 'Euro Specs Clear', 11.33, 2.125, '0.00', 11.33, 8.5, 0, 1, 0),
(16551, 294, 'Hard Hat', 18.6, 3.4875, '0.00', 18.6, 13.95, 0, 1, 0),
(16550, 294, 'FACE SHIELD WITH METAL MESH VISOR', 68, 12.75, '0.00', 68, 51, 0, 1, 0),
(16543, 294, 'PVC Red Glove Knit wrist', 11.77, 2.2075, '0.00', 11.77, 8.83, 0, 1, 0),
(16544, 294, 'PVC Red Glove Elbow 35cm', 17.12, 3.21, '0.00', 17.12, 12.84, 0, 1, 0),
(16545, 294, 'J54 SABS ANGLO BOILER SUITS, UNBLEACHED (1 Piece Overall)', 422.29, 79.18, '0.00', 422.29, 316.72, 0, 1, 0),
(16546, 294, 'Conti suits Navy Blue/Red/White/Grey/Black size 28-44', 140, 26.25, '0.00', 140, 105, 0, 1, 0),
(16549, 294, 'Bata Gumboots NSTC Black', 124.4, 23.325, '0.00', 124.4, 93.3, 0, 1, 0),
(16548, 294, 'Boot - Adapt - 71442', 577.2, 108.225, '0.00', 577.2, 432.9, 0, 1, 0),
(16547, 294, 'Bova Shoe - Multi - 71441', 563.2, 105.6, '0.00', 563.2, 422.4, 0, 1, 0),
(16564, 295, 'DROMEX Navy Polycotton CONTI SUITS with Reflective All Sizes', 197.07, 554.25, '0.00', 2956, 147.8, 0, 15, 0),
(16562, 295, 'Dromex D59 Flame and Acid JACKET All Sizes', 276, 776.25, '0.00', 4140, 207, 0, 15, 0),
(16563, 295, 'Dromex D59 Flame and Acid PANTS All Sizes', 276, 776.25, '0.00', 4140, 207, 0, 15, 0),
(16578, 296, 'Varta Industrial AA 10 Pack ', 100, 18.75, '0.00', 100, 75, 0, 1, 0),
(16576, 296, 'Energizer A76 1.5V - LR44 Pack of 2', 49.33, 46.25, '0.00', 246.67, 37, 0, 5, 0),
(16577, 296, ' Digital Stopwatch - Pro ', 69.56, 13.0425, '0.00', 69.56, 52.17, 0, 1, 0),
(16611, 297, 'Goatskin VIP, Keystone, size 9', 30.67, 5.75, '0.00', 30.67, 23, 0, 1, 0),
(16608, 297, 'Dromex Fluorescent Green Bell PU Foam DISPOSABLE & corded Earplug', 2.67, 100, '0.00', 533.33, 2, 0, 200, 0),
(16609, 297, 'Dromex Blue MUSHROOM RE-USABLE  Earplug with green cord (SNR29)', 2.93, 110, '0.00', 586.67, 2.2, 0, 200, 0),
(16610, 297, 'DROMEX Tan Pig grain, keystone, size 9', 48, 9, '0.00', 48, 36, 0, 1, 0),
(16606, 297, 'Dromex D59 Flame and Acid Jacket All Sizes', 260, 48.75, '0.00', 260, 195, 0, 1, 0),
(16607, 297, 'Dromex D59 Flame and Acid Pants All Sizes', 260, 48.75, '0.00', 260, 195, 0, 1, 0),
(16605, 297, 'DROMEX PROMAX-C4000 Coverall Type 3,4,5 &6 , Size M-3XL', 386.67, 72.5, '0.00', 386.67, 290, 0, 1, 0),
(16604, 297, 'DROMEX Promax 1000 Medical Disposable Coveralls, Chemical Proof  M - L', 156.4, 29.325, '0.00', 156.4, 117.3, 0, 1, 0),
(16603, 297, 'DROMEX PROMAX white Disposable Coveralls, LIQUID PROOF Small to 3XL', 66.67, 12.5, '0.00', 66.67, 50, 0, 1, 0),
(16618, 298, 'Chrome Leather Yoke 3XL-4XL', 226.67, 42.5, '0.00', 226.67, 170, 0, 1, 0),
(16619, 298, 'Gripper Gloves textured Palm Coted Rubber ', 10.67, 40, '0.00', 213.33, 8, 0, 20, 0),
(16617, 298, 'Dromex Chrome Leather Yoke L-2XL', 199.61, 37.4275, '0.00', 199.61, 149.71, 0, 1, 0),
(16620, 298, 'DROMEX green lined Welding glove, fully welted, Elbow length', 60, 11.25, '0.00', 60, 45, 0, 1, 0),
(16657, 299, 'P2 - SINGLE UNIFIT Filter (NRCS: AZ2011/67)', 65.33, 12.25, '0.00', 65.33, 49, 0, 1, 0),
(16656, 299, 'P2 - TWIN UNIFIT Filter (NRCS: AZ201168)', 58.67, 22, '0.00', 117.33, 44, 0, 2, 0),
(16655, 299, 'MIDIMASK PVC Single Mask - BLUE (NRCS: AZ2011/43)', 74.67, 14, '0.00', 74.67, 56, 0, 1, 0),
(16654, 299, 'Dromex MIDIMASK PVC Double Mask - BLUE (NRCS: AZ2011/45)', 81.33, 15.25, '0.00', 81.33, 61, 0, 1, 0),
(16651, 299, 'DROMEX Brown rough PVC gloves, knitted wrist', 22.8, 4.275, '0.00', 22.8, 17.1, 0, 1, 0),
(16652, 299, 'Comarex Yellow Glove Fully dipped, knitted wrist', 21.6, 4.05, '0.00', 21.6, 16.2, 0, 1, 0),
(16653, 299, 'Green Textured Heavy Duty PVC, Open Cuff, 27cm wrist length', 18.45, 3.46, '0.00', 18.45, 13.84, 0, 1, 0),
(16714, 300, 'Household Gloves- Yellow', 7.73, 34.8, '0.00', 185.6, 5.8, 0, 24, 0),
(16713, 300, 'Rough Palm, Rolled Cuff, Shoulder 55cm length', 50.67, 114, '0.00', 608, 38, 0, 12, 0),
(16712, 300, 'Chrome Leather Yoke 3XL-4XL', 224, 42, '0.00', 224, 168, 0, 1, 0),
(16711, 300, 'Cotton Crochet gloves ', 3.6, 202.5, '0.00', 1080, 2.7, 0, 300, 0),
(16708, 300, 'Leather Apron, 60 x 120, Seamless ', 128, 120, '0.00', 640, 96, 0, 5, 0),
(16709, 300, 'Drome Chrome Leather Gloves Elbow', 40, 135, '0.00', 720, 30, 0, 18, 0),
(16710, 300, 'Drome Chrome Leather Gloves  Wrist', 32, 72, '0.00', 384, 24, 0, 12, 0),
(16705, 300, 'Citronol Hand Cleaner with grit 30 Kg', 700, 131.25, '0.00', 700, 525, 0, 1, 0),
(16706, 300, 'Red heat resistant apron palm welding glove,', 57.47, 258.6, '0.00', 1379.2, 43.1, 0, 24, 0),
(16707, 300, 'Blue lined  welding glove elbow length ', 71, 159.75, '0.00', 852, 53.25, 0, 12, 0),
(16704, 300, ' Dust Mask SABS Approved', 3.2, 180, '0.00', 960, 2.4, 0, 300, 0),
(16715, 301, 'A1P2 Cartridges ( Combination Cartridges)', 51.8, 0, '0', 155.4, 51.8, 0, 3, 1),
(16716, 301, 'AUSTRA CHELSEA Boots Black Size 4 -12', 330, 0, '0', 330, 330, 0, 1, 1),
(16717, 302, 'AUSTRA CHELSEA Boots Black Size 4 -12', 412.5, 82.5, '0', 412.5, 330, 0, 1, 1),
(16718, 302, 'AUSTRA CHELSEA Boots Black Size 4 -12', 412.5, 82.5, '0', 412.5, 330, 0, 1, 1),
(16719, 303, 'A1P2 Cartridges ( Combination Cartridges)', 64.75, 12.95, '0', 64.75, 51.8, 0, 1, 1),
(16724, 305, 'Rags/kg', 20, 145, '0', 500, 14.2, 0, 25, 1),
(16725, 305, 'Toilet Paper 2ply 48\'s', 185, 76, '0', 370, 147, 0, 2, 1),
(16726, 305, 'Dromex Chrome Leather Gloves Wrist', 30, 57.6, '0', 360, 25.2, 0, 12, 1),
(16727, 305, 'Dromex Chrome Leather Gloves Elbow', 40, 102.72, '0', 480, 31.44, 0, 12, 1),
(16728, 306, '3 ply Disposable face Mask', 0.71, 0.7, '0', 3.55, 0.57, 0, 5, 0),
(16729, 306, 'Dromex Spectacles', 5, -45, '0', 5, 50, 0, 1, 0),
(16730, 306, 'Dromex Chrome Leather Gloves Wrist', 50, 498, '2', 998, 25, 0, 20, 0);

-- --------------------------------------------------------

--
-- Table structure for table `tb_settings`
--

CREATE TABLE `tb_settings` (
  `id` int NOT NULL,
  `key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `type` enum('string','integer','float','boolean','json') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'string',
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tb_settings`
--

INSERT INTO `tb_settings` (`id`, `key`, `value`, `type`, `description`, `category`, `created_at`, `updated_at`) VALUES
(1, 'site_name', 'Soft Aware', 'string', 'Company name', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(2, 'site_title', 'Software Development | Industrial Supplies | PPE', 'string', 'Site title/tagline', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(3, 'site_description', 'Experience the Future of Software Development Combined with Top-Quality Personal Protective Equipment and Industrial Supplies.', 'string', 'Site description', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(4, 'site_email', 'goodwillgts@gmail.com', 'string', 'Company email address', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(5, 'site_contact_no', '060 725 9924', 'string', 'Company contact number', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(6, 'site_vat_no', '4120320967', 'string', 'VAT registration number', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(7, 'site_address', 'No 3, Centrepoint, Market Street, Boksburg', 'string', 'Company physical address', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(8, 'site_logo', '690fa0d27bc5c-1762631890.png', 'string', 'Company logo filename', 'company', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(9, 'site_quote_terms', 'Quotation valid until 30 November 2025. Lead time is 1-2 working days after Payment has been received. 5-7 Working days for branded Items.', 'string', 'Quotation terms and conditions', 'financial', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(10, 'bank_account_name', 'Soft Aware (Pty) Ltd', 'string', 'Bank account name', 'banking', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(11, 'bank_name', 'FNB', 'string', 'Bank name', 'banking', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(12, 'bank_account_no', '63126124162', 'string', 'Bank account number', 'banking', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(13, 'bank_branch_code', '250655', 'string', 'Bank branch code', 'banking', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(14, 'bank_account_type', 'Cheque', 'string', 'Bank account type', 'banking', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(15, 'bank_reference', 'Company Name or Invoice No.', 'string', 'Payment reference instructions', 'banking', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(16, 'logo_bg', 'white', 'string', 'Logo background color', 'theme', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(17, 'navbar_bg', 'white', 'string', 'Navigation bar background color', 'theme', '2025-11-08 19:19:23', '2025-11-09 21:42:41'),
(18, 'sidebar_bg', 'red2', 'string', 'Sidebar background color', 'theme', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(19, 'body_bg', 'bg3', 'string', 'Body background color', 'theme', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(20, 'dashboard_bg', 'bg-white-gradient', 'string', 'Dashboard background color', 'theme', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(21, 'smtp_host', 'mail.softaware.co.za', 'string', 'SMTP server hostname', 'email', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(22, 'smtp_port', '587', 'string', 'SMTP server port', 'email', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(23, 'smtp_username', 'sales@softaware.co.za', 'string', 'SMTP username', 'email', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(24, 'smtp_password', '@Naledi09!', 'string', 'SMTP password', 'email', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(25, 'smtp_encryption', 'tls', 'string', 'SMTP encryption method', 'email', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(26, 'smtp_from_name', 'Soft Aware', 'string', 'Default sender name', 'email', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(27, 'smtp_from_email', 'sales@softaware.co.za', 'string', 'Default sender email', 'email', '2025-11-08 19:19:24', '2025-11-09 21:42:41'),
(28, 'site_icon', '690fa0dda6026-1762631901.png', 'string', 'Site favicon/icon filename', 'company', '2025-11-08 19:55:18', '2025-11-09 21:42:41'),
(29, 'site_base_url', 'http://billing.host/api', 'string', 'Base URL for API and assets', 'company', '2025-11-08 20:19:52', '2025-11-09 21:42:41'),
(30, 'default_markup_percentage', '25', 'string', 'Default markup percentage for calculating selling price from cost', 'financial', '2025-11-08 21:59:48', '2025-11-09 21:42:41'),
(31, 'vat_percentage', '15', 'string', NULL, 'general', '2025-11-09 18:00:37', '2025-11-09 21:42:41'),
(32, 'email_signature', '<table border=\"0\"><tbody><tr>\n    <td style=\"padding-right: 10px;\"><img src=\"https://softaware.co.za/logo.png\" width=\"70%\"></td>\n    <td style=\"border-left: 1px solid #666; padding-left: 10px; width: 50%\"><strong>Naledi</strong><br><strong>E:</strong> sales@softaware.co.za <br><strong>P:</strong> 060 725 9924</td>\n    </tr><tr></tr></tbody></table>', 'string', NULL, 'general', '2025-11-09 18:00:37', '2025-11-09 21:42:41');

-- --------------------------------------------------------

--
-- Table structure for table `tb_settings_backup`
--

CREATE TABLE `tb_settings_backup` (
  `settings_id` int NOT NULL DEFAULT '0',
  `config` text CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tb_settings_backup`
--

INSERT INTO `tb_settings_backup` (`settings_id`, `config`) VALUES
(1, 'a:15:{s:9:\"site_name\";s:10:\"Soft Aware\";s:10:\"site_title\";s:48:\"Software Development | Industrial Supplies | PPE\";s:16:\"site_description\";s:126:\"Experience the Future of Software Development Combined with Top-Quality Personal Protective Equipment and Industrial Supplies.\";s:10:\"site_email\";s:21:\"sales@softaware.co.za\";s:15:\"site_contact_no\";s:12:\"060 725 9924\";s:11:\"site_vat_no\";s:10:\"4120320967\";s:12:\"site_address\";s:42:\"No 3, Centrepoint, Market Street, Boksburg\";s:16:\"site_quote_terms\";s:154:\"<p>Quotation valid until 30 November 2025</p><p>Lead time is 1-2 working days after Payment has been received</p><p>5-7 Working days for branded Items</p>\";s:20:\"site_banking_details\";s:383:\"<table class=\"table table-bordered\"><tbody><tr><td style=\"width:100px;\">Account Name    <br>Bank Name <br>Account No   <br>Branch Code   <br>Account Type <br>Reference          </td><td>: <b>Soft Aware (Pty) Ltd</b><br>: <b>FNB</b><br>: <b>63126124162</b><br>: <b>250655</b><br>: <b>Cheque</b><br>: <b>Company Name or Invoice No.</b></td></tr></tbody></table><br><br>\";s:7:\"logo_bg\";s:5:\"white\";s:9:\"navbar_bg\";s:5:\"white\";s:10:\"sidebar_bg\";s:4:\"red2\";s:7:\"body_bg\";s:3:\"bg3\";s:12:\"dashboard_bg\";s:17:\"bg-white-gradient\";s:9:\"site_logo\";s:28:\"67321af9673a9-1731336953.png\";}');

-- --------------------------------------------------------

--
-- Table structure for table `tb_tax_rates`
--

CREATE TABLE `tb_tax_rates` (
  `tax_id` int NOT NULL,
  `name` varchar(50) NOT NULL,
  `rate` decimal(5,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `tb_transactions`
--

CREATE TABLE `tb_transactions` (
  `transaction_id` int NOT NULL,
  `transaction_date` date NOT NULL,
  `transaction_type` enum('expense','income') NOT NULL,
  `party_name` varchar(255) NOT NULL,
  `party_vat_number` varchar(10) DEFAULT NULL,
  `invoice_number` varchar(100) NOT NULL,
  `document_path` varchar(500) DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `vat_type` enum('standard','zero','exempt','non-vat') NOT NULL DEFAULT 'standard',
  `vat_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `exclusive_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `expense_category_id` int DEFAULT NULL,
  `income_type` varchar(50) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `transaction_payment_id` int DEFAULT NULL,
  `transaction_invoice_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tb_transactions`
--

INSERT INTO `tb_transactions` (`transaction_id`, `transaction_date`, `transaction_type`, `party_name`, `party_vat_number`, `invoice_number`, `document_path`, `total_amount`, `vat_type`, `vat_amount`, `exclusive_amount`, `expense_category_id`, `income_type`, `created_by`, `transaction_payment_id`, `transaction_invoice_id`, `created_at`, `updated_at`) VALUES
(53, '2025-02-07', 'income', 'BMF Technologies Limited', NULL, 'INV-01011', NULL, 30240.00, 'non-vat', 0.00, 30240.00, NULL, 'invoice_payment', 2, 11, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(54, '2025-02-11', 'income', 'Rely Precisions', '4780275113', 'INV-01004', NULL, 4486.64, 'non-vat', 0.00, 4486.64, NULL, 'invoice_payment', 2, 6, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(55, '2025-02-25', 'income', 'Rely Precisions', '4780275113', 'INV-01010', NULL, 2371.62, 'non-vat', 0.00, 2371.62, NULL, 'invoice_payment', 2, 7, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(56, '2025-03-06', 'income', 'Rely Precisions', '4780275113', 'INV-01014', NULL, 1421.89, 'non-vat', 0.00, 1421.89, NULL, 'invoice_payment', 2, 8, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(57, '2025-03-17', 'income', 'Rely Precisions', '4780275113', 'INV-01014', NULL, -68.04, 'non-vat', 0.00, -68.04, NULL, 'invoice_payment', 2, 40, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(58, '2025-03-17', 'income', 'Rely Precisions', '4780275113', 'INV-01020', NULL, 68.05, 'non-vat', 0.00, 68.05, NULL, 'invoice_payment', 2, 39, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(59, '2025-03-18', 'income', 'Rely Precisions', '4780275113', 'INV-01020', NULL, 2136.42, 'non-vat', 0.00, 2136.42, NULL, 'invoice_payment', 2, 15, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(60, '2025-03-19', 'income', 'BMF Technologies Limited', NULL, 'INV-01019', NULL, 103321.00, 'non-vat', 0.00, 103321.00, NULL, 'invoice_payment', 2, 9, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(61, '2025-03-20', 'income', 'Rely Precisions', '4780275113', 'INV-01023', NULL, 3445.32, 'non-vat', 0.00, 3445.32, NULL, 'invoice_payment', 2, 16, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(62, '2025-03-24', 'income', 'Rely Precisions', '4780275113', 'INV-01025', NULL, -45.00, 'non-vat', 0.00, -45.00, NULL, 'invoice_payment', 2, 36, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(63, '2025-03-24', 'income', 'Rely Precisions', '4780275113', 'INV-01027', NULL, 138.12, 'non-vat', 0.00, 138.12, NULL, 'invoice_payment', 2, 41, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(64, '2025-03-24', 'income', 'Rely Precisions', '4780275113', 'INV-01023', NULL, -3003.72, 'non-vat', 0.00, -3003.72, NULL, 'invoice_payment', 2, 38, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(65, '2025-03-24', 'income', 'Rely Precisions', '4780275113', 'INV-01024', NULL, 441.60, 'non-vat', 0.00, 441.60, NULL, 'invoice_payment', 2, 37, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(66, '2025-03-24', 'income', 'Rely Precisions', '4780275113', 'INV-01025', NULL, 583.20, 'non-vat', 0.00, 583.20, NULL, 'invoice_payment', 2, 35, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(67, '2025-03-24', 'income', 'Rely Precisions', '4780275113', 'INV-01026', NULL, 1885.90, 'non-vat', 0.00, 1885.90, NULL, 'invoice_payment', 2, 34, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(68, '2025-03-25', 'income', 'Rely Precisions', '4780275113', 'INV-01027', NULL, 1885.80, 'non-vat', 0.00, 1885.80, NULL, 'invoice_payment', 2, 17, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(69, '2025-04-03', 'income', 'Trencon', '4270159470', 'INV-01028', NULL, 3650.10, 'standard', 476.10, 3174.00, NULL, 'invoice_payment', 2, 30, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(70, '2025-04-08', 'income', 'Sebedisano Logistics (Pty) Ltd', NULL, 'INV-01031', NULL, 4012.57, 'standard', 523.38, 3489.19, NULL, 'invoice_payment', 2, 60, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(71, '2025-04-08', 'income', 'TMT Engineering', NULL, 'INV-01030', NULL, 4033.20, 'non-vat', 0.00, 4033.20, NULL, 'invoice_payment', 2, 42, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(72, '2025-04-09', 'income', 'Zee Lodge', NULL, 'INV-01032', NULL, 4033.20, 'non-vat', 0.00, 4033.20, NULL, 'invoice_payment', 2, 43, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(73, '2025-04-09', 'income', 'Sebedisano Logistics (Pty) Ltd', NULL, 'INV-01029', NULL, 1545.59, 'non-vat', 0.00, 1545.59, NULL, 'invoice_payment', 2, 18, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(74, '2025-04-11', 'income', 'Rely Precisions', '4780275113', 'INV-01035', NULL, 316.65, 'non-vat', 0.00, 316.65, NULL, 'invoice_payment', 2, 20, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(75, '2025-04-11', 'income', 'Rely Precisions', '4780275113', 'INV-01034', NULL, 952.60, 'non-vat', 0.00, 952.60, NULL, 'invoice_payment', 2, 19, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(76, '2025-04-12', 'income', 'Sebedisano Logistics (Pty) Ltd', NULL, 'INV-01033', NULL, 1932.00, 'non-vat', 0.00, 1932.00, NULL, 'invoice_payment', 2, 44, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(77, '2025-04-16', 'income', 'Rely Precisions', '4780275113', 'INV-01036', NULL, 158.70, 'standard', 20.70, 138.00, NULL, 'invoice_payment', 2, 21, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(78, '2025-04-20', 'income', 'Zee Lodge', NULL, 'INV-01037', NULL, 69.60, 'non-vat', 0.00, 69.60, NULL, 'invoice_payment', 2, 45, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(79, '2025-04-22', 'income', 'Zee Lodge', NULL, 'INV-01037', NULL, 342.57, 'non-vat', 0.00, 342.57, NULL, 'invoice_payment', 2, 22, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(80, '2025-05-07', 'income', 'Rely Precisions', '4780275113', 'INV-01038', NULL, 20.81, 'non-vat', 0.00, 20.81, NULL, 'invoice_payment', 2, 46, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(81, '2025-05-07', 'income', 'Rely Precisions', '4780275113', 'INV-01038', NULL, 803.39, 'non-vat', 0.00, 803.39, NULL, 'invoice_payment', 2, 23, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(82, '2025-05-08', 'income', 'Sebedisano Logistics (Pty) Ltd', NULL, 'INV-01031', NULL, 1.00, 'standard', 0.13, 0.87, NULL, 'invoice_payment', 2, 61, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(83, '2025-05-20', 'income', 'Zee Lodge', NULL, 'INV-01039', NULL, 927.45, 'standard', 120.97, 806.48, NULL, 'invoice_payment', 2, 47, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(84, '2025-05-21', 'income', 'Rely Precisions', '4780275113', 'INV-01040', NULL, 4429.59, 'standard', 577.76, 3851.83, NULL, 'invoice_payment', 2, 24, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(85, '2025-06-05', 'income', 'Rely Precisions', '4780275113', 'INV-01041', NULL, 2333.69, 'standard', 304.38, 2029.31, NULL, 'invoice_payment', 2, 25, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(86, '2025-06-11', 'income', 'TMT Engineering', NULL, 'INV-01042', NULL, 5213.33, 'standard', 680.00, 4533.33, NULL, 'invoice_payment', 2, 26, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(87, '2025-06-20', 'income', 'Rely Precisions', '4780275113', 'INV-01043', NULL, 1113.97, 'standard', 145.30, 968.67, NULL, 'invoice_payment', 2, 48, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(88, '2025-06-24', 'income', 'Cartoon Candy (Pty) Ltd', '4340181405', 'INV-01044', NULL, 2568.53, 'standard', 335.02, 2233.51, NULL, 'invoice_payment', 2, 27, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(89, '2025-07-04', 'income', 'Trencon', '4270159470', 'INV-01046', NULL, 3446.93, 'standard', 449.60, 2997.33, NULL, 'invoice_payment', 2, 28, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(90, '2025-07-14', 'income', 'Rely Precisions', '4780275113', 'INV-01048', NULL, 2771.36, 'standard', 361.48, 2409.88, NULL, 'invoice_payment', 2, 49, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(91, '2025-07-16', 'income', 'COD- Ingala Insulation', NULL, 'INV-01049', NULL, 3407.07, 'standard', 444.40, 2962.67, NULL, 'invoice_payment', 2, 50, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(92, '2025-07-22', 'income', 'Trencon', '4270159470', 'INV-01056', NULL, 1449.00, 'standard', 189.00, 1260.00, NULL, 'invoice_payment', 2, 56, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(93, '2025-07-28', 'income', 'TMT Engineering', NULL, 'INV-01051', NULL, 3827.20, 'standard', 499.20, 3328.00, NULL, 'invoice_payment', 2, 52, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(94, '2025-07-31', 'income', 'Extrupet', '4940214390', 'INV-01052', NULL, 25178.10, 'standard', 3284.10, 21894.00, NULL, 'invoice_payment', 2, 53, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(95, '2025-08-01', 'income', 'Rely Precisions', '4780275113', 'INV-01053', NULL, 2052.11, 'standard', 267.67, 1784.44, NULL, 'invoice_payment', 2, 54, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(96, '2025-08-07', 'income', 'Cartoon Candy (Pty) Ltd', '4340181405', 'INV-01045', NULL, 243.23, 'standard', 31.72, 211.51, NULL, 'invoice_payment', 2, 29, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(97, '2025-08-07', 'income', 'TMT Engineering', NULL, 'INV-01055', NULL, 730.48, 'standard', 95.28, 635.20, NULL, 'invoice_payment', 2, 55, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(98, '2025-08-11', 'income', 'Cartoon Candy (Pty) Ltd', '4340181405', 'INV-01054', NULL, 659.33, 'standard', 86.00, 573.33, NULL, 'invoice_payment', 2, 31, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(99, '2025-09-16', 'income', 'Rely Precisions', '4780275113', 'INV-01058', NULL, 3982.69, 'standard', 519.48, 3463.21, NULL, 'invoice_payment', 2, 58, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(100, '2025-09-29', 'income', 'Extrupet', '4940214390', 'INV-01057', NULL, 22578.33, 'standard', 2945.00, 19633.33, NULL, 'invoice_payment', 2, 57, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(101, '2025-10-03', 'income', 'Cartoon Candy (Pty) Ltd', '4340181405', 'INV-01050', NULL, 2811.75, 'standard', 366.75, 2445.00, NULL, 'invoice_payment', 2, 51, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(102, '2025-10-06', 'income', 'Rely Precisions', '4780275113', 'INV-01059', NULL, 2152.11, 'standard', 280.71, 1871.40, NULL, 'invoice_payment', 2, 59, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(103, '2025-10-24', 'income', 'Trencon', '4270159470', 'INV-01060', NULL, 40786.67, 'standard', 5301.80, 35484.87, NULL, 'invoice_payment', 2, 32, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(104, '2025-11-07', 'income', 'Rely Precisions', '4780275113', 'INV-01061', NULL, 3013.00, 'standard', 393.00, 2620.00, NULL, 'invoice_payment', 2, 33, NULL, '2025-11-22 12:32:15', '2025-11-22 12:32:15'),
(105, '2025-03-23', 'expense', 'Benoni Bolt and Tool', '4750145676', '314747', NULL, 103.50, 'standard', 13.50, 90.00, 5, NULL, 2, NULL, 1004, '2025-11-23 18:19:35', '2025-11-23 18:19:35'),
(106, '2025-03-17', 'expense', 'Citronol Hand Cleaner', '4410170726', 'INV32856', NULL, 688.85, 'standard', 89.85, 599.00, 5, NULL, 2, NULL, 1020, '2025-11-23 18:24:44', '2025-11-23 18:24:44'),
(107, '2025-03-07', 'expense', 'Crazy Plastics', '4330261712', '112600206135', NULL, 379.90, 'standard', 49.55, 330.35, 5, NULL, 2, NULL, 1014, '2025-11-23 18:26:26', '2025-11-23 18:26:26'),
(108, '2025-03-24', 'expense', 'Crazy Plastics', '4330261712', '112001007408', NULL, 539.90, 'standard', 70.42, 469.48, 5, NULL, 2, NULL, 1023, '2025-11-23 18:28:15', '2025-11-23 18:28:15'),
(109, '2025-03-24', 'expense', 'Lukas ', '4050261892', 'A0261654', NULL, 403.59, 'standard', 52.64, 350.95, 5, NULL, 2, NULL, 1025, '2025-11-23 18:29:57', '2025-11-23 18:29:57'),
(110, '2025-03-18', 'expense', 'Mican', '4480206798', 'IN682150', NULL, 213.24, 'standard', 27.81, 185.43, 5, NULL, 2, NULL, 1020, '2025-11-23 18:32:13', '2025-11-23 18:32:13'),
(111, '2025-03-19', 'expense', 'Mican', '4480206798', 'IN682448', NULL, 1166.03, 'standard', 152.09, 1013.94, 5, NULL, 2, NULL, 1020, '2025-11-23 18:33:51', '2025-11-23 18:33:51'),
(112, '2025-03-24', 'expense', 'Mican', '4480206798', 'IN683314', NULL, 844.01, 'standard', 110.09, 733.92, 5, NULL, 2, NULL, 1026, '2025-11-23 18:35:28', '2025-11-23 18:35:28'),
(113, '2025-03-19', 'expense', 'Procon', '4100157092', '769629', NULL, 832.60, 'standard', 108.60, 724.00, 5, NULL, 2, NULL, 1020, '2025-11-23 18:37:32', '2025-11-23 18:37:32'),
(114, '2025-03-14', 'expense', 'Procon', '4900157092', '770051', NULL, 400.20, 'standard', 52.20, 348.00, 5, NULL, 2, NULL, 1026, '2025-11-23 18:40:44', '2025-11-23 18:40:44'),
(115, '2025-11-23', 'expense', 'Procon', '', '770769', NULL, 781.08, 'non-vat', 0.00, 781.08, 5, NULL, 2, NULL, 1027, '2025-11-23 18:45:18', '2025-11-23 18:45:18'),
(116, '2025-03-07', 'expense', 'Procon', '4900157092', '767392', NULL, 741.75, 'standard', 96.75, 645.00, 5, NULL, 2, NULL, 1014, '2025-11-23 18:47:03', '2025-11-23 18:47:03'),
(117, '2025-04-14', 'expense', 'Benoni Bolt and Tool', '4750145676', '315756', NULL, 103.50, 'standard', 13.50, 90.00, 5, NULL, 2, NULL, 1034, '2025-11-23 18:51:19', '2025-11-23 18:51:19'),
(118, '2025-04-11', 'expense', 'Citronol Hand Cleaner', '4410170726', 'INV33041', NULL, 688.85, 'standard', 89.85, 599.00, 5, NULL, 2, NULL, 1034, '2025-11-23 18:52:48', '2025-11-23 18:52:48'),
(119, '2025-04-04', 'expense', 'Mican', '4480206798', 'IN685741', NULL, 251.40, 'standard', 32.79, 218.61, 5, NULL, 2, NULL, 1029, '2025-11-23 18:54:21', '2025-11-23 18:54:21'),
(120, '2025-04-09', 'expense', 'Mican', '4480206798', 'IN687521', NULL, 1785.22, 'standard', 232.85, 1552.37, 5, NULL, 2, NULL, 1031, '2025-11-23 19:14:18', '2025-11-23 19:14:18'),
(121, '2025-04-22', 'expense', 'Mican', '4480206798', 'IN689924', NULL, 128.13, 'standard', 16.71, 111.42, 5, NULL, 2, NULL, 1036, '2025-11-23 19:17:42', '2025-11-23 19:17:42'),
(122, '2025-04-23', 'expense', 'Mican', '4480206798', 'IN690295', NULL, 47.33, 'standard', 6.17, 41.16, 5, NULL, 2, NULL, 1030, '2025-11-23 19:20:04', '2025-11-23 19:20:04'),
(123, '2025-04-10', 'expense', 'Novus Sealing SA', '4120224755', 'INV9163', NULL, 1622.31, 'standard', 211.61, 1410.70, 5, NULL, 2, NULL, 1028, '2025-11-23 19:22:29', '2025-11-23 19:22:29'),
(124, '2025-04-09', 'expense', 'Pinnacle Weld', '', 'IN439005', NULL, 805.00, 'non-vat', 0.00, 805.00, 5, NULL, 2, NULL, 1030, '2025-11-23 19:30:32', '2025-11-23 19:30:32'),
(125, '2025-04-25', 'expense', 'Pinnacle Weld', '4083257589', 'IN438157', NULL, 762.45, 'standard', 99.45, 663.00, 5, NULL, 2, NULL, 1031, '2025-11-23 19:43:06', '2025-11-23 19:43:06'),
(126, '2025-04-15', 'expense', 'Pinnacle Weld', '4780265106', 'IN439807', NULL, 143.75, 'standard', 18.75, 125.00, 5, NULL, 2, NULL, 1035, '2025-11-23 19:45:04', '2025-11-23 19:45:04'),
(127, '2025-04-22', 'expense', 'Pinnacle Weld', '4780265106', 'IN440396', NULL, 62.10, 'standard', 8.10, 54.00, 5, NULL, 2, NULL, 1035, '2025-11-23 19:46:34', '2025-11-23 19:46:34'),
(128, '2025-04-17', 'expense', 'Pinnacle Weld', '4803257589', 'IN44081', NULL, 103.50, 'standard', 13.50, 90.00, 5, NULL, 2, NULL, 1037, '2025-11-23 19:48:48', '2025-11-23 19:48:48'),
(129, '2025-04-25', 'expense', 'Pinnacle Weld', '4780265106', 'IN439006', NULL, 1081.00, 'standard', 141.00, 940.00, 5, NULL, 2, NULL, 1031, '2025-11-23 19:50:29', '2025-11-23 19:50:29'),
(130, '2025-04-03', 'expense', 'Procon', '4900157092', '772218', NULL, 1771.35, 'standard', 231.05, 1540.30, 5, NULL, 2, NULL, 1031, '2025-11-23 19:51:58', '2025-11-23 19:51:58'),
(131, '2025-04-10', 'expense', 'Procon', '4900157092', '773566', NULL, 333.50, 'standard', 43.50, 290.00, 5, NULL, 2, NULL, 1032, '2025-11-23 19:53:42', '2025-11-23 19:53:42'),
(132, '2025-04-23', 'expense', 'Procon', '4900157092', '775302', NULL, 255.25, 'standard', 33.29, 221.96, 5, NULL, 2, NULL, 1036, '2025-11-23 19:55:14', '2025-11-23 19:55:14'),
(133, '2025-04-11', 'expense', 'Stitch Direct', '4160264414', 'IN1246857', NULL, 255.25, 'standard', 33.29, 221.96, 5, NULL, 2, NULL, 1031, '2025-11-23 19:58:09', '2025-11-23 19:58:09'),
(134, '2025-04-23', 'expense', 'Stitch Direct', '4160264414', 'IN12468920', NULL, 411.70, 'standard', 53.70, 358.00, 5, NULL, 2, NULL, 1032, '2025-11-23 20:00:11', '2025-11-23 20:00:11'),
(135, '2025-05-21', 'expense', 'Benoni Bolt and Tool', '4750145676', '317374', NULL, 207.00, 'standard', 27.00, 180.00, 5, NULL, 2, NULL, 1040, '2025-11-23 20:01:39', '2025-11-23 20:01:39'),
(136, '2025-05-25', 'expense', 'Citronol Hand Cleaner', '4410170726', 'INV33249', NULL, 688.85, 'standard', 89.85, 599.00, 5, NULL, 2, NULL, 1040, '2025-11-23 20:02:43', '2025-11-23 20:02:43'),
(137, '2025-05-05', 'expense', 'Crazy Plastics', '4330261712', '1126001009990', NULL, 179.90, 'standard', 23.47, 156.43, 5, NULL, 2, NULL, 1038, '2025-11-23 20:03:56', '2025-11-23 20:03:56'),
(138, '2025-05-25', 'expense', 'Handy Grments', '4070197142', 'LM205296', NULL, 620.98, 'standard', 81.00, 539.98, 5, NULL, 2, NULL, 1040, '2025-11-23 20:06:06', '2025-11-23 20:06:06'),
(139, '2025-05-07', 'expense', 'Mican', '4480206798', 'IN692616', NULL, 209.90, 'standard', 27.38, 182.52, 5, NULL, 2, NULL, 1038, '2025-11-23 20:07:11', '2025-11-23 20:07:11'),
(140, '2025-05-12', 'expense', 'Mican', '4480206798', 'IN693975', NULL, 361.05, 'standard', 47.09, 313.96, 5, NULL, 2, NULL, 1039, '2025-11-23 20:09:02', '2025-11-23 20:09:02'),
(141, '2025-05-13', 'expense', 'Pinnacle Weld', '4780265106', 'IN442414', NULL, 161.00, 'standard', 21.00, 140.00, 5, NULL, 2, NULL, 1039, '2025-11-23 20:12:23', '2025-11-23 20:12:23'),
(142, '2025-05-22', 'expense', 'Pinnacle Weld', '4780265106', 'IN444027', NULL, 897.00, 'standard', 117.00, 780.00, 5, NULL, 2, NULL, 1040, '2025-11-23 20:14:24', '2025-11-23 20:14:24'),
(143, '2025-05-27', 'expense', 'Pinnacle Weld', '4780265106', 'IN444506', NULL, 810.75, 'standard', 105.75, 705.00, 5, NULL, 2, NULL, 1033, '2025-11-23 20:16:39', '2025-11-23 20:16:39'),
(144, '2025-05-07', 'expense', 'Procon', '4900015709', '776522', NULL, 408.25, 'standard', 53.25, 355.00, 5, NULL, 2, NULL, 1038, '2025-11-23 20:18:49', '2025-11-23 20:18:49'),
(145, '2025-05-22', 'expense', 'Procon', '4900157092', '779707', NULL, 1456.36, 'standard', 189.96, 1266.40, 5, NULL, 2, NULL, 1040, '2025-11-23 20:20:17', '2025-11-23 20:20:17'),
(146, '2025-05-20', 'expense', 'Stitch Direct', '4160264414', 'IN1269151', NULL, 105.00, 'standard', 13.70, 91.30, 5, NULL, 2, NULL, 1039, '2025-11-23 20:22:21', '2025-11-23 20:22:21'),
(147, '2025-06-06', 'expense', 'Barron Clothing', '4930261294', 'INV00950460', NULL, 114.99, 'standard', 15.00, 99.99, 19, NULL, 2, NULL, NULL, '2025-11-24 10:32:35', '2025-11-24 10:32:35'),
(148, '2025-04-02', 'expense', 'Barron Clothing', '4930261294', 'NV00908180', NULL, 447.34, 'standard', 58.35, 388.99, 19, NULL, 2, NULL, NULL, '2025-11-24 10:34:51', '2025-11-24 10:34:51'),
(149, '2025-06-25', 'expense', 'Citronol Hand Cleaner', '4410170726', 'INV33452', NULL, 688.85, 'standard', 89.85, 599.00, 5, NULL, 2, NULL, 1043, '2025-11-24 10:38:21', '2025-11-24 10:38:21'),
(150, '2025-06-06', 'expense', 'Crazy Plastics', '4330261712', '1126001011748', NULL, 179.90, 'standard', 23.47, 156.43, 5, NULL, 2, NULL, 1041, '2025-11-24 10:42:50', '2025-11-24 10:42:50'),
(151, '2025-06-06', 'expense', 'Handy Grments', '4070197142', 'LM205446', NULL, 1132.75, 'standard', 147.75, 985.00, 5, NULL, 2, NULL, 1041, '2025-11-24 10:44:12', '2025-11-24 10:44:12'),
(152, '2025-06-30', 'expense', 'Hennox Suppplies', '4770255742', 'IN294295', NULL, 39.10, 'standard', 5.10, 34.00, 19, NULL, 2, NULL, NULL, '2025-11-24 10:57:06', '2025-11-24 10:57:06'),
(153, '2025-06-05', 'expense', 'Mican', '4480206798', 'IN700736', NULL, 1618.10, 'standard', 211.06, 1407.04, 19, NULL, 2, NULL, NULL, '2025-11-24 10:58:34', '2025-11-24 10:58:34'),
(154, '2025-06-10', 'expense', 'Mican', '4480206798', 'IN701619', NULL, 28.75, 'standard', 3.75, 25.00, 19, NULL, 2, NULL, NULL, '2025-11-24 11:05:33', '2025-11-24 11:05:33'),
(155, '2025-06-11', 'expense', 'Mican', '4480206798', 'IN702015', NULL, 3450.00, 'standard', 450.00, 3000.00, 5, NULL, 2, NULL, 1042, '2025-11-24 11:07:16', '2025-11-24 11:07:16'),
(156, '2025-06-05', 'expense', 'Mican', '4480206798', 'IN70664', NULL, 209.90, 'standard', 27.38, 182.52, 5, NULL, 2, NULL, 1041, '2025-11-24 11:09:40', '2025-11-24 11:09:40'),
(157, '2025-06-25', 'expense', 'Mican', '4480206798', 'IN705205', NULL, 83.01, 'standard', 10.83, 72.18, 5, NULL, 2, NULL, 1043, '2025-11-24 11:11:34', '2025-11-24 11:11:34'),
(158, '2025-06-25', 'expense', 'Mican', '4480206798', 'IN705147', NULL, 2267.80, 'standard', 295.80, 1972.00, 5, NULL, 2, NULL, 1044, '2025-11-24 11:13:16', '2025-11-24 11:13:16'),
(159, '2025-06-27', 'expense', 'Mican', '4480206798', 'IN705956', NULL, 182.28, 'standard', 23.78, 158.50, 5, NULL, 2, NULL, 1045, '2025-11-24 11:20:34', '2025-11-24 11:20:34'),
(160, '2025-06-25', 'expense', 'Pinnacle Weld', '4780265106', 'IN447880', NULL, 1968.80, 'standard', 256.80, 1712.00, 5, NULL, 2, NULL, 1046, '2025-11-24 11:27:42', '2025-11-24 11:27:42'),
(161, '2025-06-06', 'expense', 'Procon', '4900157092', '782612', NULL, 408.25, 'standard', 53.25, 355.00, 5, NULL, 2, NULL, 1041, '2025-11-24 11:29:12', '2025-11-24 11:29:12'),
(162, '2025-06-25', 'expense', 'Procon', '4900157092', '785808', NULL, 107.30, 'standard', 14.00, 93.30, 5, NULL, 2, NULL, 1043, '2025-11-24 11:31:29', '2025-11-24 11:31:29'),
(163, '2025-06-05', 'expense', 'Stitch Direct', '4160264414', 'IN12469301', NULL, 86.25, 'standard', 11.25, 75.00, 5, NULL, 2, NULL, 1033, '2025-11-24 11:34:24', '2025-11-24 11:34:24'),
(164, '2025-06-13', 'expense', 'Stitch Direct', '4160264414', 'IN12469376', NULL, 51.75, 'standard', 6.75, 45.00, 19, NULL, 2, NULL, NULL, '2025-11-24 13:44:26', '2025-11-24 13:44:26'),
(165, '2025-06-26', 'expense', 'Stitch Direct', '4160264441', 'IN12469479', NULL, 616.40, 'standard', 80.40, 536.00, 5, NULL, 2, NULL, 1046, '2025-11-24 14:14:21', '2025-11-24 14:14:21'),
(166, '2025-06-24', 'expense', 'Stitch Direct', '4160264414', 'IN12469450', NULL, 446.20, 'standard', 58.20, 388.00, 5, NULL, 2, NULL, 1042, '2025-11-24 14:16:56', '2025-11-24 14:16:56'),
(167, '2025-07-10', 'expense', 'Mican', '4480206798', 'IN709348', NULL, 30.20, 'standard', 3.94, 26.26, 19, NULL, 2, NULL, NULL, '2025-11-24 14:22:03', '2025-11-24 14:22:03'),
(168, '2025-07-07', 'expense', 'Mican', '4480206798', 'IN708141', NULL, 23.87, 'standard', 3.11, 20.76, 19, NULL, 2, NULL, NULL, '2025-11-24 14:22:53', '2025-11-24 14:22:53'),
(169, '2025-07-17', 'expense', 'Hennox Suppplies', '4770252742', 'IN297061', NULL, 2070.00, 'standard', 270.00, 1800.00, 5, NULL, 2, NULL, 1049, '2025-11-24 14:24:30', '2025-11-24 14:24:30'),
(170, '2025-07-23', 'expense', 'Ital Workwear', '4330241987', 'INV0002954', NULL, 2281.03, 'standard', 297.53, 1983.50, 5, NULL, 2, NULL, 1050, '2025-11-24 14:27:05', '2025-11-24 14:27:05'),
(171, '2025-07-15', 'expense', 'Mican', '4480206798', 'IN710271', NULL, 1559.40, 'standard', 203.40, 1356.00, 5, NULL, 2, NULL, 1048, '2025-11-24 14:28:08', '2025-11-24 14:28:08'),
(172, '2025-07-16', 'expense', 'Mican', '4480206798', 'IN710581', NULL, 646.30, 'standard', 84.30, 562.00, 5, NULL, 2, NULL, 1048, '2025-11-24 14:29:33', '2025-11-24 14:29:33'),
(173, '2025-07-17', 'expense', 'Mican', '4480206798', 'IN711052', NULL, 651.00, 'standard', 84.91, 566.09, 5, NULL, 2, NULL, 1049, '2025-11-24 14:30:50', '2025-11-24 14:30:50'),
(174, '2025-07-17', 'expense', 'Mican', '4480206798', 'IN711316', NULL, 162.75, 'standard', 21.23, 141.52, 19, NULL, 2, NULL, NULL, '2025-11-24 14:32:25', '2025-11-24 14:32:25'),
(175, '2025-07-22', 'expense', 'Mican', '4480206798', 'IN712234', NULL, 182.28, 'standard', 23.78, 158.50, 5, NULL, 2, NULL, 1050, '2025-11-24 14:33:34', '2025-11-24 14:33:34'),
(176, '2025-07-30', 'expense', 'Mican', '4480206798', 'IN714081', NULL, 3251.11, 'standard', 424.06, 2827.05, 5, NULL, 2, NULL, 1051, '2025-11-24 14:35:30', '2025-11-24 14:35:30'),
(177, '2025-08-11', 'expense', 'Catercare', '4570110025', 'IN111972', NULL, 563.50, 'standard', 73.50, 490.00, 5, NULL, 2, NULL, 1054, '2025-11-24 14:48:50', '2025-11-24 14:48:50'),
(178, '2025-08-05', 'expense', 'Hennox Suppplies', '4770252742', 'IN299589', NULL, 2139.18, 'standard', 279.02, 1860.16, 5, NULL, 2, NULL, 1052, '2025-11-24 14:51:46', '2025-11-24 14:51:46'),
(179, '2025-08-05', 'expense', 'Mican', '4480206798', 'IN715449', NULL, 12791.73, 'standard', 1668.49, 11123.24, 5, NULL, 2, NULL, 1052, '2025-11-24 14:54:19', '2025-11-24 14:54:19'),
(180, '2025-08-05', 'expense', 'Pinnacle Weld', '4780265106', 'IN453867', NULL, 1391.50, 'standard', 181.50, 1210.00, 5, NULL, 2, NULL, 1053, '2025-11-24 14:56:11', '2025-11-24 14:56:11'),
(181, '2025-08-18', 'expense', 'Pinnacle Weld', '4780265106', 'IN455494', NULL, 759.00, 'standard', 99.00, 660.00, 5, NULL, 2, NULL, 1056, '2025-11-24 14:57:37', '2025-11-24 14:57:37'),
(182, '2025-08-05', 'expense', 'Procon', '4900157092', '792712', NULL, 4583.67, 'standard', 597.87, 3985.80, 5, NULL, 2, NULL, 1052, '2025-11-24 14:58:46', '2025-11-24 14:58:46'),
(183, '2025-08-11', 'expense', 'Procon', '4900157092', '793563', NULL, 547.86, 'standard', 71.46, 476.40, 5, NULL, 2, NULL, 1055, '2025-11-24 15:00:29', '2025-11-24 15:00:29'),
(184, '2025-07-25', 'expense', 'Stitch Direct', '4160264414', 'IN12470004', NULL, 231.15, 'standard', 30.15, 201.00, 5, NULL, 2, NULL, 1056, '2025-11-24 15:01:50', '2025-11-24 15:01:50'),
(185, '2025-09-17', 'expense', 'Africa Cleaning Products', '4300278670', '1008205650', NULL, 153.41, 'standard', 20.01, 133.40, 5, NULL, 2, NULL, 1058, '2025-11-24 15:02:40', '2025-11-24 15:02:40'),
(186, '2025-09-08', 'expense', 'Hennox Suppplies', '4770252742', 'IN304239', NULL, 5257.80, 'standard', 685.80, 4572.00, 5, NULL, 2, NULL, 1057, '2025-11-24 15:04:35', '2025-11-24 15:04:35'),
(187, '2025-09-02', 'expense', 'Mican', '4480206798', 'IN722723', NULL, 10658.48, 'standard', 1390.24, 9268.24, 5, NULL, 2, NULL, 1057, '2025-11-24 15:05:21', '2025-11-24 15:05:21'),
(188, '2025-09-16', 'expense', 'Mican', '4480206798', 'IN726521', NULL, 215.21, 'standard', 28.07, 187.14, 5, NULL, 2, NULL, 1058, '2025-11-24 15:06:26', '2025-11-24 15:06:26'),
(189, '2025-09-08', 'expense', 'Procon', '4900157092', '797513', NULL, 1716.72, 'standard', 223.92, 1492.80, 5, NULL, 2, NULL, 1057, '2025-11-24 15:35:53', '2025-11-24 15:35:53'),
(190, '2025-09-17', 'expense', 'Procon', '4900157092', '799149', NULL, 2679.50, 'standard', 349.50, 2330.00, 5, NULL, 2, NULL, 1058, '2025-11-24 15:36:52', '2025-11-24 15:36:52'),
(191, '2025-10-08', 'expense', 'Procon', '4900157092', '802114', NULL, 1697.40, 'standard', 221.40, 1476.00, 5, NULL, 2, NULL, 1059, '2025-11-24 15:38:05', '2025-11-24 15:38:05'),
(192, '2025-03-04', 'expense', 'Hennox Suppplies', '', 'Hennox', NULL, 26640.00, 'non-vat', 0.00, 26640.00, 5, NULL, 2, NULL, 1011, '2025-11-24 15:48:19', '2025-11-24 15:48:19'),
(193, '2025-03-20', 'expense', 'Hennox Suppplies', '', 'HEN', NULL, 91020.00, 'non-vat', 0.00, 91020.00, 5, NULL, 2, NULL, 1019, '2025-11-24 15:51:03', '2025-11-24 15:51:03'),
(194, '2025-06-15', 'expense', 'Company Expenses', '', 'Spur', NULL, 65.80, 'non-vat', 0.00, 65.80, 11, NULL, 2, NULL, NULL, '2025-11-24 18:07:01', '2025-11-24 18:07:01'),
(195, '2025-06-07', 'expense', 'Company Expenses', '4126985525', 'Engen- Fuel', NULL, 200.00, 'standard', 26.09, 173.91, 19, NULL, 2, NULL, NULL, '2025-11-24 18:09:46', '2025-11-24 18:09:46'),
(196, '2025-05-22', 'expense', 'Company Expenses', '', 'Engen- Fuel', NULL, 200.00, 'non-vat', 0.00, 200.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:11:02', '2025-11-24 18:11:02'),
(197, '2025-03-20', 'expense', 'Company Expenses', '', 'Engen- Fuel', NULL, 300.00, 'non-vat', 0.00, 300.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:11:51', '2025-11-24 18:11:51'),
(198, '2025-06-30', 'expense', 'Company Expenses', '', 'Engen- Fuel', NULL, 300.00, 'non-vat', 0.00, 300.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:12:34', '2025-11-24 18:12:34'),
(199, '2025-05-07', 'expense', 'Company Expenses', '', 'Engen- Fuel', NULL, 200.00, 'non-vat', 0.00, 200.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:13:20', '2025-11-24 18:13:20'),
(200, '2025-04-15', 'expense', 'Company Expenses', '', 'Engen - Fuel', NULL, 300.00, 'non-vat', 0.00, 300.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:14:06', '2025-11-24 18:14:06'),
(201, '2025-05-13', 'expense', 'Company Expenses', '', 'Engen- Fuel', NULL, 200.00, 'non-vat', 0.00, 200.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:14:52', '2025-11-24 18:14:52'),
(202, '2025-06-13', 'expense', 'Company Expenses', '', 'Engen - Fuel', NULL, 300.00, 'non-vat', 0.00, 300.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:15:39', '2025-11-24 18:15:39'),
(203, '2025-07-16', 'expense', 'Crazy Plastics', '4330261712', '1126001014239', NULL, 179.90, 'standard', 23.47, 156.43, 5, NULL, 2, NULL, NULL, '2025-11-24 18:30:09', '2025-11-24 18:30:09'),
(204, '2025-09-08', 'expense', 'Company Expenses', '', 'Astron- Fuel', NULL, 400.20, 'non-vat', 0.00, 400.20, 19, NULL, 2, NULL, NULL, '2025-11-24 18:31:51', '2025-11-24 18:31:51'),
(205, '2025-08-27', 'expense', 'Company Expenses', '', 'Astron- Fuel', NULL, 150.00, 'non-vat', 0.00, 150.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:33:05', '2025-11-24 18:33:05'),
(206, '2025-08-18', 'expense', 'Company Expenses', '', 'Engen- Fuel', NULL, 100.00, 'non-vat', 0.00, 100.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:33:56', '2025-11-24 18:33:56'),
(207, '2025-10-27', 'expense', 'Company Expenses', '', 'Engen - Fuel', NULL, 300.00, 'non-vat', 0.00, 300.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:34:51', '2025-11-24 18:34:51'),
(208, '2025-07-16', 'expense', 'Company Expenses', '', 'Engen - Fuel', NULL, 200.00, 'non-vat', 0.00, 200.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:35:38', '2025-11-24 18:35:38'),
(209, '2025-10-28', 'expense', 'Company Expenses', '', 'Macd- Staff Lunch', NULL, 187.80, 'non-vat', 0.00, 187.80, 19, NULL, 2, NULL, NULL, '2025-11-24 18:37:18', '2025-11-24 18:37:18'),
(210, '2025-10-10', 'expense', 'Company Expenses', '', 'Bravo Fuel- Fuel', NULL, 400.00, 'non-vat', 0.00, 400.00, 19, NULL, 2, NULL, NULL, '2025-11-24 18:39:06', '2025-11-24 18:39:06');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `sys_audit_logs`
--
ALTER TABLE `sys_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indexes for table `sys_credentials`
--
ALTER TABLE `sys_credentials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `service_environment_unique` (`service_name`,`environment`),
  ADD KEY `idx_service_name` (`service_name`),
  ADD KEY `idx_credential_type` (`credential_type`),
  ADD KEY `idx_environment` (`environment`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_expires_at` (`expires_at`),
  ADD KEY `fk_credentials_created_by` (`created_by`),
  ADD KEY `fk_credentials_updated_by` (`updated_by`);

--
-- Indexes for table `sys_installed_updates`
--
ALTER TABLE `sys_installed_updates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `update_id` (`update_id`),
  ADD KEY `installed_at` (`installed_at`),
  ADD KEY `version` (`version`);

--
-- Indexes for table `sys_migrations`
--
ALTER TABLE `sys_migrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `update_migration` (`update_id`,`migration_name`),
  ADD KEY `update_id` (`update_id`),
  ADD KEY `executed_at` (`executed_at`);

--
-- Indexes for table `sys_notifications`
--
ALTER TABLE `sys_notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_read` (`user_id`,`is_read`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `idx_type` (`type`);

--
-- Indexes for table `sys_notification_preferences`
--
ALTER TABLE `sys_notification_preferences`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_channel` (`user_id`,`channel`),
  ADD KEY `idx_user` (`user_id`);

--
-- Indexes for table `sys_notification_queue`
--
ALTER TABLE `sys_notification_queue`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_channel` (`channel`),
  ADD KEY `idx_created` (`created_at`);

--
-- Indexes for table `sys_notification_templates`
--
ALTER TABLE `sys_notification_templates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_channel` (`channel`);

--
-- Indexes for table `sys_password_resets`
--
ALTER TABLE `sys_password_resets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_otp` (`otp`),
  ADD KEY `idx_expires_at` (`expires_at`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `sys_permissions`
--
ALTER TABLE `sys_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_slug` (`slug`),
  ADD KEY `idx_permissions_created_at` (`created_at`),
  ADD KEY `idx_permission_group` (`permission_group`);

--
-- Indexes for table `sys_roles`
--
ALTER TABLE `sys_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_slug` (`slug`),
  ADD KEY `idx_roles_created_at` (`created_at`);

--
-- Indexes for table `sys_role_permissions`
--
ALTER TABLE `sys_role_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `role_permission_unique` (`role_id`,`permission_id`),
  ADD KEY `idx_role_id` (`role_id`),
  ADD KEY `idx_permission_id` (`permission_id`);

--
-- Indexes for table `sys_settings`
--
ALTER TABLE `sys_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key` (`key`),
  ADD KEY `idx_key` (`key`),
  ADD KEY `idx_is_public` (`is_public`),
  ADD KEY `idx_settings_type` (`type`);

--
-- Indexes for table `sys_users`
--
ALTER TABLE `sys_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_is_admin` (`is_admin`),
  ADD KEY `idx_users_created_at` (`created_at`);

--
-- Indexes for table `sys_user_roles`
--
ALTER TABLE `sys_user_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_role_unique` (`user_id`,`role_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_role_id` (`role_id`);

--
-- Indexes for table `tb_accounts`
--
ALTER TABLE `tb_accounts`
  ADD PRIMARY KEY (`account_id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `tb_categories`
--
ALTER TABLE `tb_categories`
  ADD PRIMARY KEY (`category_id`);

--
-- Indexes for table `tb_contacts`
--
ALTER TABLE `tb_contacts`
  ADD PRIMARY KEY (`contact_id`);

--
-- Indexes for table `tb_expense_categories`
--
ALTER TABLE `tb_expense_categories`
  ADD PRIMARY KEY (`category_id`),
  ADD UNIQUE KEY `category_name` (`category_name`);

--
-- Indexes for table `tb_groups`
--
ALTER TABLE `tb_groups`
  ADD PRIMARY KEY (`group_id`),
  ADD KEY `group_parent_id` (`group_parent_id`);

--
-- Indexes for table `tb_installed_updates`
--
ALTER TABLE `tb_installed_updates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `update_id` (`update_id`),
  ADD KEY `installed_at` (`installed_at`),
  ADD KEY `version` (`version`);

--
-- Indexes for table `tb_invoices`
--
ALTER TABLE `tb_invoices`
  ADD PRIMARY KEY (`invoice_id`);

--
-- Indexes for table `tb_invoice_items`
--
ALTER TABLE `tb_invoice_items`
  ADD PRIMARY KEY (`item_id`);

--
-- Indexes for table `tb_ledger`
--
ALTER TABLE `tb_ledger`
  ADD PRIMARY KEY (`entry_id`),
  ADD KEY `account_id` (`account_id`);

--
-- Indexes for table `tb_migrations`
--
ALTER TABLE `tb_migrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `update_migration` (`update_id`,`migration_name`),
  ADD KEY `update_id` (`update_id`),
  ADD KEY `executed_at` (`executed_at`);

--
-- Indexes for table `tb_payments`
--
ALTER TABLE `tb_payments`
  ADD PRIMARY KEY (`payment_id`);

--
-- Indexes for table `tb_pricing`
--
ALTER TABLE `tb_pricing`
  ADD PRIMARY KEY (`pricing_id`),
  ADD UNIQUE KEY `pricing_id` (`pricing_id`),
  ADD KEY `fk_pricing_category` (`pricing_category_id`);

--
-- Indexes for table `tb_quotations`
--
ALTER TABLE `tb_quotations`
  ADD PRIMARY KEY (`quotation_id`);

--
-- Indexes for table `tb_quote_items`
--
ALTER TABLE `tb_quote_items`
  ADD PRIMARY KEY (`item_id`);

--
-- Indexes for table `tb_settings`
--
ALTER TABLE `tb_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key` (`key`),
  ADD KEY `category` (`category`);

--
-- Indexes for table `tb_tax_rates`
--
ALTER TABLE `tb_tax_rates`
  ADD PRIMARY KEY (`tax_id`);

--
-- Indexes for table `tb_transactions`
--
ALTER TABLE `tb_transactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD UNIQUE KEY `idx_tb_transactions_payment_id` (`transaction_payment_id`),
  ADD KEY `expense_category_id` (`expense_category_id`),
  ADD KEY `idx_transaction_date` (`transaction_date`),
  ADD KEY `idx_transaction_type` (`transaction_type`),
  ADD KEY `idx_party_name` (`party_name`),
  ADD KEY `idx_invoice_number` (`invoice_number`),
  ADD KEY `idx_transaction_invoice` (`transaction_invoice_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `sys_audit_logs`
--
ALTER TABLE `sys_audit_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=72;

--
-- AUTO_INCREMENT for table `sys_credentials`
--
ALTER TABLE `sys_credentials`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sys_installed_updates`
--
ALTER TABLE `sys_installed_updates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sys_migrations`
--
ALTER TABLE `sys_migrations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `sys_notifications`
--
ALTER TABLE `sys_notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `sys_notification_preferences`
--
ALTER TABLE `sys_notification_preferences`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sys_notification_queue`
--
ALTER TABLE `sys_notification_queue`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sys_notification_templates`
--
ALTER TABLE `sys_notification_templates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sys_password_resets`
--
ALTER TABLE `sys_password_resets`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `sys_permissions`
--
ALTER TABLE `sys_permissions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=81;

--
-- AUTO_INCREMENT for table `sys_roles`
--
ALTER TABLE `sys_roles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `sys_role_permissions`
--
ALTER TABLE `sys_role_permissions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `sys_settings`
--
ALTER TABLE `sys_settings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `sys_users`
--
ALTER TABLE `sys_users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `sys_user_roles`
--
ALTER TABLE `sys_user_roles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tb_accounts`
--
ALTER TABLE `tb_accounts`
  MODIFY `account_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `tb_categories`
--
ALTER TABLE `tb_categories`
  MODIFY `category_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `tb_contacts`
--
ALTER TABLE `tb_contacts`
  MODIFY `contact_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=68;

--
-- AUTO_INCREMENT for table `tb_expense_categories`
--
ALTER TABLE `tb_expense_categories`
  MODIFY `category_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `tb_groups`
--
ALTER TABLE `tb_groups`
  MODIFY `group_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `tb_installed_updates`
--
ALTER TABLE `tb_installed_updates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tb_invoices`
--
ALTER TABLE `tb_invoices`
  MODIFY `invoice_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1063;

--
-- AUTO_INCREMENT for table `tb_invoice_items`
--
ALTER TABLE `tb_invoice_items`
  MODIFY `item_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1205;

--
-- AUTO_INCREMENT for table `tb_ledger`
--
ALTER TABLE `tb_ledger`
  MODIFY `entry_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tb_migrations`
--
ALTER TABLE `tb_migrations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tb_payments`
--
ALTER TABLE `tb_payments`
  MODIFY `payment_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- AUTO_INCREMENT for table `tb_quotations`
--
ALTER TABLE `tb_quotations`
  MODIFY `quotation_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=307;

--
-- AUTO_INCREMENT for table `tb_quote_items`
--
ALTER TABLE `tb_quote_items`
  MODIFY `item_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16731;

--
-- AUTO_INCREMENT for table `tb_settings`
--
ALTER TABLE `tb_settings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `tb_tax_rates`
--
ALTER TABLE `tb_tax_rates`
  MODIFY `tax_id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tb_transactions`
--
ALTER TABLE `tb_transactions`
  MODIFY `transaction_id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=211;

-- --------------------------------------------------------

--
-- Structure for view `sys_permissions_with_roles_count`
--
DROP TABLE IF EXISTS `sys_permissions_with_roles_count`;

CREATE ALGORITHM=UNDEFINED DEFINER=`desilope`@`localhost` SQL SECURITY DEFINER VIEW `sys_permissions_with_roles_count`  AS SELECT `p`.`id` AS `id`, `p`.`name` AS `name`, `p`.`slug` AS `slug`, `p`.`description` AS `description`, `p`.`created_at` AS `created_at`, `p`.`updated_at` AS `updated_at`, count(`rp`.`role_id`) AS `roles_count` FROM (`sys_permissions` `p` left join `sys_role_permissions` `rp` on((`p`.`id` = `rp`.`permission_id`))) GROUP BY `p`.`id` ;

-- --------------------------------------------------------

--
-- Structure for view `sys_roles_with_permissions_count`
--
DROP TABLE IF EXISTS `sys_roles_with_permissions_count`;

CREATE ALGORITHM=UNDEFINED DEFINER=`desilope`@`localhost` SQL SECURITY DEFINER VIEW `sys_roles_with_permissions_count`  AS SELECT `r`.`id` AS `id`, `r`.`name` AS `name`, `r`.`slug` AS `slug`, `r`.`description` AS `description`, `r`.`created_at` AS `created_at`, `r`.`updated_at` AS `updated_at`, count(`rp`.`permission_id`) AS `permissions_count` FROM (`sys_roles` `r` left join `sys_role_permissions` `rp` on((`r`.`id` = `rp`.`role_id`))) GROUP BY `r`.`id` ;

-- --------------------------------------------------------

--
-- Structure for view `sys_users_with_roles`
--
DROP TABLE IF EXISTS `sys_users_with_roles`;

CREATE ALGORITHM=UNDEFINED DEFINER=`desilope`@`localhost` SQL SECURITY DEFINER VIEW `sys_users_with_roles`  AS SELECT `u`.`id` AS `id`, `u`.`username` AS `username`, `u`.`email` AS `email`, `u`.`first_name` AS `first_name`, `u`.`last_name` AS `last_name`, `u`.`is_active` AS `is_active`, `u`.`is_admin` AS `is_admin`, `u`.`created_at` AS `created_at`, `u`.`updated_at` AS `updated_at`, group_concat(`r`.`name` separator ', ') AS `roles`, group_concat(`r`.`id` separator ',') AS `role_ids` FROM ((`sys_users` `u` left join `sys_user_roles` `ur` on((`u`.`id` = `ur`.`user_id`))) left join `sys_roles` `r` on((`ur`.`role_id` = `r`.`id`))) GROUP BY `u`.`id` ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `sys_audit_logs`
--
ALTER TABLE `sys_audit_logs`
  ADD CONSTRAINT `sys_audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `sys_credentials`
--
ALTER TABLE `sys_credentials`
  ADD CONSTRAINT `fk_sys_credentials_created_by` FOREIGN KEY (`created_by`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sys_credentials_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `sys_users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `sys_notifications`
--
ALTER TABLE `sys_notifications`
  ADD CONSTRAINT `sys_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `sys_users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sys_notification_preferences`
--
ALTER TABLE `sys_notification_preferences`
  ADD CONSTRAINT `sys_notification_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `sys_users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sys_role_permissions`
--
ALTER TABLE `sys_role_permissions`
  ADD CONSTRAINT `fk_sys_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `sys_permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sys_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `sys_roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sys_user_roles`
--
ALTER TABLE `sys_user_roles`
  ADD CONSTRAINT `fk_sys_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `sys_roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sys_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `sys_users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tb_groups`
--
ALTER TABLE `tb_groups`
  ADD CONSTRAINT `tb_groups_ibfk_3` FOREIGN KEY (`group_parent_id`) REFERENCES `tb_categories` (`category_id`) ON DELETE CASCADE;

--
-- Constraints for table `tb_ledger`
--
ALTER TABLE `tb_ledger`
  ADD CONSTRAINT `fk_ledger_account` FOREIGN KEY (`account_id`) REFERENCES `tb_accounts` (`account_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `tb_pricing`
--
ALTER TABLE `tb_pricing`
  ADD CONSTRAINT `fk_pricing_category` FOREIGN KEY (`pricing_category_id`) REFERENCES `tb_categories` (`category_id`) ON DELETE RESTRICT;

--
-- Constraints for table `tb_transactions`
--
ALTER TABLE `tb_transactions`
  ADD CONSTRAINT `tb_transactions_ibfk_1` FOREIGN KEY (`expense_category_id`) REFERENCES `tb_expense_categories` (`category_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
