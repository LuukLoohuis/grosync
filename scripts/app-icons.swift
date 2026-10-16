// Makes the home-screen icons from public/favicon.png: the logo on the cream app background.
// The logo itself is transparent, and iOS fills transparent pixels with black.
// Run from the repo root: swift scripts/app-icons.swift
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
let cream = CGColor(colorSpace: srgb, components: [0xF4 / 255.0, 0xF2 / 255.0, 0xEA / 255.0, 1])!
let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: "public/favicon.png") as CFURL, nil)!
let logo = CGImageSourceCreateImageAtIndex(source, 0, nil)!

/// `logoScale` is the share of the icon the logo's square takes; a maskable icon needs more room,
/// because Android may crop it down to a circle of 80%.
func write(_ path: String, size: Int, logoScale: CGFloat) {
  let context = CGContext(
    data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: srgb,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  context.interpolationQuality = .high
  context.setFillColor(cream)
  context.fill(CGRect(x: 0, y: 0, width: size, height: size))
  let side = CGFloat(size) * logoScale
  let inset = (CGFloat(size) - side) / 2
  context.draw(logo, in: CGRect(x: inset, y: inset, width: side, height: side))
  let destination = CGImageDestinationCreateWithURL(
    URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(destination, context.makeImage()!, nil)
  guard CGImageDestinationFinalize(destination) else { fatalError("Could not write \(path)") }
  print("\(path) \(size)x\(size)")
}

try FileManager.default.createDirectory(atPath: "public/icons", withIntermediateDirectories: true)
write("public/apple-touch-icon.png", size: 180, logoScale: 0.82)
write("public/icons/icon-192.png", size: 192, logoScale: 0.82)
write("public/icons/icon-512.png", size: 512, logoScale: 0.82)
write("public/icons/icon-maskable-512.png", size: 512, logoScale: 0.76)
