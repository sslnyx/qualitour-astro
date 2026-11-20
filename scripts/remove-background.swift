import Foundation
import Vision
import CoreImage
import AppKit

// Remove the background of a photo (vehicles on the Private Transfers page): keeps the foreground subject, transparent elsewhere.
// Apple Vision, runs locally on macOS 14+, no upload. Build and run:
//   swiftc -O scripts/remove-background.swift -o /tmp/cutout && /tmp/cutout photo.jpg photo.png
// Check the result on a coloured backdrop for white fringes or holes before using it.
let args = CommandLine.arguments
guard args.count == 3, let image = NSImage(contentsOfFile: args[1]),
      let tiff = image.tiffRepresentation, let ci = CIImage(data: tiff) else { print("cannot read input"); exit(1) }
let handler = VNImageRequestHandler(ciImage: ci, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let result = request.results?.first else { print("no foreground found"); exit(2) }
let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
let out = CIImage(cvPixelBuffer: buffer)
let context = CIContext()
guard let cg = context.createCGImage(out, from: out.extent) else { print("render failed"); exit(3) }
let rep = NSBitmapImageRep(cgImage: cg)
guard let png = rep.representation(using: .png, properties: [:]) else { exit(4) }
try png.write(to: URL(fileURLWithPath: args[2]))
print("ok \(cg.width)x\(cg.height)")
